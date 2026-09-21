import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { buildTrendReport, createEvidenceItems, dedupeEvidence, scoreQualifiedPerson } from "./trend-engine.mjs";
import { buildContentMap } from "./content-map-engine.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const MCP_CONFIG = join(ROOT, "config", "mcporter.json");
const HOST = "127.0.0.1";
const PORT = Number(process.env.SIGNAL_PORT || 4317);
const RUN_TTL_MS = 10 * 60 * 1000;
const MAX_BODY_BYTES = 256 * 1024;
const READ_ONLY_TOOLS = new Set([
  "search_people",
  "get_person_profile",
  "get_company_profile",
  "get_company_posts",
  "search_posts",
  "close_session"
]);

const runs = new Map();
const connection = {
  configured: true,
  verified: false,
  verifiedAt: null,
  message: "LinkedIn MCP is configured but has not passed a live read."
};

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(body));
}

function safeMessage(error) {
  const raw = String(error?.message || error || "Unknown error");
  if (/auth|login|checkpoint|captcha|session/i.test(raw)) {
    return "LinkedIn authentication needs attention. Complete the visible sign-in or checkpoint, then retry.";
  }
  if (/busy|lease|another server/i.test(raw)) {
    return "The LinkedIn browser is busy. Wait for the current read to finish, then retry.";
  }
  if (/rate.?limit|too many requests/i.test(raw)) {
    return "LinkedIn paused this read. Keep the completed evidence and try a smaller run later.";
  }
  if (/timed? out|timeout/i.test(raw)) {
    return "The LinkedIn read timed out. The completed evidence is preserved; retry when the browser is responsive.";
  }
  return "The live read could not finish. Check the visible LinkedIn browser and retry.";
}

function emit(run, type, payload = {}) {
  const event = {
    id: run.sequence += 1,
    type,
    at: new Date().toISOString(),
    ...payload
  };
  run.history.push(event);
  const frame = `id: ${event.id}\nevent: ${type}\ndata: ${JSON.stringify(event)}\n\n`;
  for (const client of run.clients) client.write(frame);
  return event;
}

function closeRun(run) {
  for (const client of run.clients) client.end();
  run.clients.clear();
  setTimeout(() => runs.delete(run.id), RUN_TTL_MS).unref();
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) throw new Error("LinkedIn MCP returned no data.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("LinkedIn MCP returned an unreadable response.");
  }
}

function unwrapToolResult(value) {
  if (!value || typeof value !== "object") return value;
  if (value.isError) {
    const text = Array.isArray(value.content)
      ? value.content.map((item) => item?.text || "").join(" ")
      : "LinkedIn MCP reported an error.";
    throw new Error(text);
  }
  if (value.structuredContent && typeof value.structuredContent === "object") {
    return value.structuredContent.result || value.structuredContent;
  }
  if (Array.isArray(value.content)) {
    const text = value.content.find((item) => item?.type === "text" && item.text)?.text;
    if (text) {
      try { return JSON.parse(text); } catch { return { text }; }
    }
  }
  return value.result && typeof value.result === "object" ? value.result : value;
}

function callTool(tool, args, run = null, { allowVerify = false } = {}) {
  if (!READ_ONLY_TOOLS.has(tool) && !(allowVerify && tool === "get_my_profile")) {
    throw new Error(`Tool ${tool} is not in the read-only allowlist.`);
  }
  if (run?.cancelled) throw new Error("Run cancelled.");

  return new Promise((resolveCall, rejectCall) => {
    const child = spawn("mcporter", [
      "--config", MCP_CONFIG,
      "call", `linkedin-visible.${tool}`,
      "--args", JSON.stringify(args || {}),
      "--output", "json",
      "--timeout", "180000"
    ], {
      cwd: ROOT,
      env: { ...process.env, UV_HTTP_TIMEOUT: "300" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    if (run) run.currentChild = child;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", rejectCall);
    child.on("close", (code) => {
      if (run) run.currentChild = null;
      if (run?.cancelled) return rejectCall(new Error("Run cancelled."));
      if (code !== 0) return rejectCall(new Error(stderr.trim() || stdout.trim() || `Tool exited with code ${code}.`));
      try {
        resolveCall(unwrapToolResult(parseJsonOutput(stdout)));
      } catch (error) {
        rejectCall(error);
      }
    });
  });
}

function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^(view|open)\s+/i, "")
    .replace(/[’']s profile$/i, "")
    .trim();
}

function lines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(cleanText)
    .filter((line) => line.length > 1 && !/^(home|my network|jobs|messaging|notifications|search)$/i.test(line));
}

function allReferences(result) {
  const groups = result?.references && typeof result.references === "object"
    ? Object.values(result.references)
    : [];
  return groups.flatMap((group) => Array.isArray(group) ? group : []);
}

function getSection(result, preferred = []) {
  const sections = result?.sections && typeof result.sections === "object" ? result.sections : {};
  for (const key of preferred) if (sections[key]) return sections[key];
  return Object.values(sections).find((value) => typeof value === "string") || "";
}

function profileSlug(url) {
  try {
    const match = new URL(url, "https://www.linkedin.com").pathname.match(/\/in\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  } catch { return ""; }
}

function companySlug(url) {
  try {
    const match = new URL(url, "https://www.linkedin.com").pathname.match(/\/company\/([^/]+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  } catch { return ""; }
}

function absoluteLinkedInUrl(url) {
  try { return new URL(url, "https://www.linkedin.com").href; }
  catch { return ""; }
}

function titleFromSlug(slug) {
  return slug.split(/[-_]/).filter(Boolean).map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
}

function primaryResultBlocks(searchResult) {
  const text = getSection(searchResult, ["search_results"]);
  const pattern = /(?:^|\n\n)([^\n]{2,100}?)\s*•\s*(?:1st|2nd|3rd\+?)(?=\n)/gim;
  const matches = [...text.matchAll(pattern)];
  return matches.map((match, index) => ({
    name: cleanText(match[1]),
    text: text.slice(match.index, matches[index + 1]?.index ?? text.length)
  }));
}

function candidateScore(block, keywords, location) {
  const text = `${block.name} ${block.text}`.toLowerCase();
  const keywordTokens = cleanText(keywords).toLowerCase().split(/\s+/).filter((token) => token.length > 2);
  const locationTokens = cleanText(location).toLowerCase().split(/[\s,]+/).filter((token) => token.length > 3);
  let score = keywordTokens.reduce((total, token) => total + (text.includes(token) ? 3 : 0), 0);
  score += locationTokens.reduce((total, token) => total + (text.includes(token) ? 5 : 0), 0);
  if (/\b(vp|vice president|head|director|chief revenue|cro|revops|revenue operations)\b/i.test(block.text)) score += 8;
  if (/\b(b2b|saas|software|cloud)\b/i.test(block.text)) score += 5;
  return score;
}

function personReferences(searchResult, limit, keywords = "", location = "", excludeUsernames = []) {
  const found = [];
  const seen = new Set();
  const excluded = new Set(excludeUsernames.map((value) => cleanText(value).toLowerCase()));
  const blocks = primaryResultBlocks(searchResult);
  const blockByName = new Map(blocks.map((block) => [block.name.toLowerCase(), block]));
  for (const ref of allReferences(searchResult)) {
    if (ref?.kind !== "person" || !ref.url) continue;
    const slug = profileSlug(ref.url);
    if (!slug || seen.has(slug) || excluded.has(slug.toLowerCase())) continue;
    const name = cleanText(ref.text) || titleFromSlug(slug);
    const block = blockByName.get(name.toLowerCase());
    if (blocks.length && !block) continue;
    seen.add(slug);
    found.push({
      url: absoluteLinkedInUrl(ref.url),
      slug,
      name,
      context: cleanText(ref.context),
      searchEvidence: block?.text || "",
      candidateScore: candidateScore(block || { name, text: "" }, keywords, location)
    });
  }
  return found.sort((a, b) => b.candidateScore - a.candidateScore).slice(0, limit);
}

function extractHeadline(mainLines, name) {
  const nameIndex = mainLines.findIndex((line) => line.toLowerCase() === name.toLowerCase());
  const candidates = nameIndex >= 0 ? mainLines.slice(nameIndex + 1, nameIndex + 6) : mainLines.slice(0, 6);
  return candidates.find((line) =>
    line.length > 4 &&
    !/connections|followers|contact info|message|connect|follow/i.test(line) &&
    !/^(?:·\s*)?(?:1st|2nd|3rd\+?)$/i.test(line) &&
    line !== "·"
  ) || "Current role unavailable";
}

function splitHeadline(headline) {
  const normalized = cleanText(headline).replace(/^[^\p{L}\p{N}]+/u, "");
  const atParts = normalized.split(/\s*(?:@|\bat\b)\s*/i).map(cleanText).filter(Boolean);
  if (atParts.length > 1) {
    return {
      role: atParts[0],
      company: cleanText(atParts[1].split("|")[0]) || "Company unavailable"
    };
  }
  const pipeParts = normalized.split(/\s*\|\s*/).map(cleanText).filter(Boolean);
  return { role: pipeParts[0] || normalized, company: "Company unavailable" };
}

function extractLocation(mainLines) {
  return mainLines.find((line) =>
    /London|United Kingdom|England|Berlin|Munich|Germany|DACH|Europe|Remote|Zurich|Vienna/i.test(line) &&
    !/[@#|]|\b(?:VP|Head|Director|Manager|Founder|Sales|Revenue)\b/i.test(line)
  ) || "Location unavailable";
}

function firstUsefulPost(text) {
  return lines(text).find((line) =>
    line.length >= 40 &&
    line.length <= 240 &&
    line.split(/\s+/).length >= 7 &&
    !/like|comment|repost|followers|connections|show more|feed post|loaded \d+|visible to|\b\d+\s+(?:days?|weeks?|months?)\s+ago\b/i.test(line)
  ) || "No recent public post was returned.";
}

function parseCompanySize(text) {
  const match = String(text || "").match(/([\d,.]+(?:\+|\s*[-–]\s*[\d,.]+)?)\s+employees?/i);
  return match ? `${match[1]} employees` : "Employee count unavailable";
}

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LI";
}

function evidenceFromResult({ result, fallbackText, sourceId, personId = "", companyId = "", subjectName, type, fallbackUrl, retrievedAt }) {
  const postRefs = allReferences(result).filter((item) => item?.url && /post|article|update/i.test(`${item.kind || ""} ${item.url}`));
  if (!postRefs.length) {
    return createEvidenceItems({ sourceId, personId, companyId, subjectName, type, url: fallbackUrl, text: fallbackText, retrievedAt });
  }
  return dedupeEvidence(postRefs.flatMap((ref, index) => createEvidenceItems({
    sourceId: `${sourceId}-P${index + 1}`,
    personId,
    companyId,
    subjectName,
    type,
    url: absoluteLinkedInUrl(ref.url),
    text: `${ref.text || ""}\n${ref.context || ""}`,
    retrievedAt
  })));
}

function normalizePerson(ref, profile, index, sourceOffset = 0) {
  const retrievedAt = new Date().toISOString();
  const mainText = getSection(profile, ["main_profile", "profile"]);
  const mainLines = lines(mainText);
  const name = ref.name || mainLines[0] || titleFromSlug(ref.slug);
  const headline = extractHeadline(mainLines, name);
  const parsed = splitHeadline(headline);
  const companyRef = allReferences(profile).find((item) => item?.kind === "company" && item.url);
  const company = parsed.company !== "Company unavailable"
    ? parsed.company
    : cleanText(companyRef?.text) || parsed.company;
  const postText = getSection(profile, ["posts"]);
  const signal = firstUsefulPost(postText);
  const sourceId = `LIVE-${String(sourceOffset + index + 1).padStart(2, "0")}`;
  const personId = `live-${ref.slug || index + 1}`;
  const profileUrl = absoluteLinkedInUrl(profile?.url || ref.url);
  const companyId = companySlug(companyRef?.url || "") || cleanText(company).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const profileEvidence = createEvidenceItems({
    sourceId,
    personId,
    companyId,
    subjectName: name,
    type: "profile",
    url: profileUrl,
    text: `${ref.searchEvidence || ""}\n${mainText}`,
    retrievedAt
  });
  const postEvidence = evidenceFromResult({
    result: profile,
    fallbackText: postText,
    sourceId,
    personId,
    companyId,
    subjectName: name,
    type: "person_post",
    fallbackUrl: profileUrl,
    retrievedAt
  });
  return {
    id: personId,
    username: ref.slug,
    name,
    initials: initials(name),
    role: parsed.role,
    company,
    companyId,
    companySlug: companySlug(companyRef?.url || ""),
    companyUrl: absoluteLinkedInUrl(companyRef?.url || ""),
    region: extractLocation(mainLines),
    size: "Employee count unavailable",
    fit: 0,
    timing: 0,
    class: "Needs scoring",
    signal,
    source: sourceId,
    unknown: [
      company === "Company unavailable" ? "current company" : null,
      "company size",
      signal.startsWith("No recent") ? "recent public activity" : null
    ].filter(Boolean).join(", ") || "None recorded",
    promoted: /promot|new role|started a new position/i.test(`${mainText}\n${postText}`),
    profileUrl,
    retrievedAt,
    personPostsText: postText,
    companyPostsText: "",
    companyAbout: "",
    evidenceItems: dedupeEvidence([...profileEvidence, ...postEvidence]),
    sources: [{ id: sourceId, url: profileUrl, retrievedAt, supports: ["name", "role", "company", "location", "activity"] }]
  };
}

function applyCompany(person, companyResult, sourceIndex) {
  const about = getSection(companyResult, ["about"]);
  const posts = getSection(companyResult, ["posts"]);
  const sourceId = `LIVE-${String(sourceIndex).padStart(2, "0")}`;
  const companyUrl = absoluteLinkedInUrl(companyResult?.url || person.companyUrl);
  const size = parseCompanySize(about);
  const signal = firstUsefulPost(posts);
  const retrievedAt = new Date().toISOString();
  const companyEvidence = createEvidenceItems({
    sourceId,
    personId: person.id,
    companyId: person.companyId,
    subjectName: person.company,
    type: "company",
    url: companyUrl,
    text: about,
    retrievedAt
  });
  const companyPostEvidence = evidenceFromResult({
    result: companyResult,
    fallbackText: posts,
    sourceId,
    personId: person.id,
    companyId: person.companyId,
    subjectName: person.company,
    type: "company_post",
    fallbackUrl: companyUrl,
    retrievedAt
  });
  return {
    ...person,
    size,
    signal: !signal.startsWith("No recent") ? signal : person.signal,
    unknown: person.unknown.split(", ").filter((item) => item !== "company size" || size === "Employee count unavailable").join(", ") || "None recorded",
    companyAbout: about,
    companyPostsText: posts,
    evidenceItems: dedupeEvidence([...(person.evidenceItems || []), ...companyEvidence, ...companyPostEvidence]),
    source: `${person.source} + ${sourceId}`,
    sources: [...person.sources, { id: sourceId, url: companyUrl, retrievedAt, supports: ["company context", "company size", "company activity"] }]
  };
}

function publicPerson(person) {
  const { personPostsText, companyPostsText, companyAbout, evidenceItems, ...safePerson } = person;
  return safePerson;
}

function buildDraft(person, offer) {
  const firstName = person.name.split(/\s+/)[0] || "there";
  const usableSignal = !person.signal.startsWith("No recent") ? person.signal : `${person.role} at ${person.company}`;
  const evidenceId = person.sources[0]?.id || "SOURCE";
  const review = `Hi ${firstName},\n\nI came across your work as ${person.role} at ${person.company}. [${evidenceId}] ${usableSignal} [${person.sources.at(-1)?.id || evidenceId}]\n\n${offer}\n\nWould a short example of the workflow be useful?`;
  return {
    title: `${person.name} · ${person.company}`,
    review,
    clean: review.replace(/\s*\[[^\]]+\]/g, ""),
    evidence: person.sources.length
  };
}

async function runResearch(run) {
  try {
    emit(run, "connection", { state: "active", message: "Live research in progress" });
    emit(run, "searching", { message: `Searching LinkedIn for ${run.input.keywords} in ${run.input.location}`, progress: 8 });

    const searchResult = await callTool("search_people", {
      keywords: run.input.keywords,
      location: run.input.location
    }, run);
    connection.verified = true;
    connection.verifiedAt = new Date().toISOString();
    connection.message = "LinkedIn connected with a successful live read.";

    const refs = personReferences(
      searchResult,
      run.input.batchSize,
      run.input.keywords,
      run.input.location,
      run.input.excludeUsernames
    );
    const basePeople = run.input.existingPeople;
    const baseEvidence = dedupeEvidence(run.input.existingEvidence);
    if (!refs.length) {
      const report = buildTrendReport({ people: basePeople, evidence: baseEvidence, periodDays: 30 });
      emit(run, "complete", {
        count: 0,
        requestedCount: run.input.batchSize,
        candidateCount: refs.length,
        message: "No inspectable profiles were returned for this search.",
        people: [],
        themes: report.themes,
        evidence: report.evidence,
        cohort: report.cohort,
        periodDays: report.periodDays,
        contentIdeas: buildContentMap(report.themes)
      });
      closeRun(run);
      return;
    }

    const people = [];
    let runEvidence = baseEvidence.slice();
    for (let index = 0; index < refs.length; index += 1) {
      if (run.cancelled) throw new Error("Run cancelled.");
      const ref = refs[index];
      emit(run, "searching", { message: `Reading profile ${index + 1} of ${refs.length}`, progress: 15 + Math.round(index / refs.length * 45) });
      const profile = await callTool("get_person_profile", {
        linkedin_username: ref.slug,
        sections: "experience,posts",
        max_scrolls: 1
      }, run);
      let person = normalizePerson(ref, profile, index, run.input.sourceOffset);
      people.push(person);
      emit(run, "person", { person: publicPerson(person), current: index + 1, total: refs.length, progress: 28 + Math.round(index / refs.length * 35) });

      if (person.companySlug) {
        emit(run, "searching", { message: `Reading ${person.company} company context`, progress: 35 + Math.round(index / refs.length * 35) });
        try {
          const companyResult = await callTool("get_company_profile", {
            company_name: person.companySlug,
            sections: "about,posts"
          }, run);
          person = applyCompany(person, companyResult, run.input.sourceOffset + refs.length + index + 1);
          people[index] = person;
          emit(run, "company", { personId: person.id, person: publicPerson(person), progress: 42 + Math.round(index / refs.length * 35) });
          if (person.companyPostsText.trim()) emit(run, "post", { personId: person.id, sourceCount: person.sources.length, message: `Recent public activity attached for ${person.company}` });
        } catch (error) {
          emit(run, "company", { personId: person.id, warning: safeMessage(error), progress: 42 + Math.round(index / refs.length * 35) });
        }
      }

      people[index] = scoreQualifiedPerson(people[index], run.input.context);
      runEvidence = dedupeEvidence([...runEvidence, ...(people[index].evidenceItems || [])]);
      emit(run, "fit", {
        personId: people[index].id,
        fit: people[index].fit,
        timing: people[index].timing,
        timingSignals: people[index].timingSignals,
        classification: people[index].class,
        qualified: people[index].trendQualified,
        exclusionReasons: people[index].exclusionReasons,
        breakdown: people[index].fitBreakdown,
        progress: 55 + Math.round((index + 1) / refs.length * 24)
      });
      const provisionalReport = buildTrendReport({
        people: [...basePeople, ...people],
        evidence: runEvidence,
        periodDays: 30,
        provisional: true
      });
      emit(run, "trend", { ...provisionalReport, progress: 58 + Math.round((index + 1) / refs.length * 22) });
    }

    try {
      emit(run, "searching", { message: "Checking recent market posts", progress: 82 });
      const postResult = await callTool("search_posts", {
        keywords: run.input.trendQuery,
        date_posted: "past-month",
        max_pages: 1
      }, run);
      const marketPostText = getSection(postResult, ["search_results"]);
      const marketSourceId = `LIVE-${String(run.input.sourceOffset + refs.length * 2 + 1).padStart(2, "0")}`;
      const marketEvidence = evidenceFromResult({
        result: postResult,
        fallbackText: marketPostText,
        sourceId: marketSourceId,
        subjectName: run.input.trendQuery,
        type: "market_post",
        fallbackUrl: absoluteLinkedInUrl(postResult?.url || "https://www.linkedin.com/search/results/content/"),
        retrievedAt: new Date().toISOString()
      });
      runEvidence = dedupeEvidence([...runEvidence, ...marketEvidence]);
      emit(run, "post", { message: "Recent market search attached", sourceUrl: postResult?.url || "", progress: 87 });
    } catch (error) {
      emit(run, "post", { warning: safeMessage(error), progress: 87 });
    }

    const finalReport = buildTrendReport({
      people: [...basePeople, ...people],
      evidence: runEvidence,
      periodDays: 30,
      provisional: false
    });
    const themes = finalReport.themes;
    emit(run, "trend", { ...finalReport, progress: 91 });

    const drafts = {};
    for (const person of people) {
      if (person.fit < 55) continue;
      drafts[person.id] = buildDraft(person, run.input.context.offer);
      emit(run, "draft", { personId: person.id, draft: drafts[person.id], progress: 94 });
    }
    const contentIdeas = buildContentMap(themes);
    emit(run, "complete", {
      count: people.length,
      requestedCount: run.input.batchSize,
      candidateCount: refs.length,
      message: `${people.length} record${people.length === 1 ? "" : "s"} ready for review`,
      people: people.map(publicPerson),
      themes,
      evidence: finalReport.evidence,
      cohort: finalReport.cohort,
      periodDays: finalReport.periodDays,
      provisional: false,
      drafts,
      contentIdeas,
      progress: 100
    });
    closeRun(run);
  } catch (error) {
    if (run.cancelled) {
      emit(run, "error", { code: "cancelled", message: "Live research stopped. Completed evidence is preserved." });
    } else {
      connection.verified = false;
      connection.message = safeMessage(error);
      emit(run, "error", { code: "live_read_failed", message: safeMessage(error) });
    }
    closeRun(run);
  }
}

async function readBody(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  }
  return body ? JSON.parse(body) : {};
}

function validateRunInput(body) {
  const context = body?.context && typeof body.context === "object" ? body.context : {};
  const role = cleanText(context.role) || "Head of RevOps";
  const market = cleanText(context.market) || "B2B SaaS";
  const location = cleanText(body.location) || cleanText(context.region).split("+")[0] || "London";
  const baseKeywords = cleanText(body.keywords) || cleanText(`${role.split(",")[0]} ${market.split("·")[0]}`);
  const keywords = baseKeywords.toLowerCase().includes(location.toLowerCase())
    ? baseKeywords
    : `${baseKeywords} ${location}`;
  const excludeUsernames = Array.isArray(body.excludeUsernames)
    ? body.excludeUsernames.map((value) => cleanText(value).replace(/[^a-z0-9_-]/gi, "")).filter(Boolean).slice(0, 50)
    : [];
  const existingPeople = Array.isArray(body.existingPeople)
    ? body.existingPeople.slice(0, 50).filter((person) => person && typeof person === "object").map((person) => ({
        id: cleanText(person.id),
        username: cleanText(person.username),
        name: cleanText(person.name),
        role: cleanText(person.role),
        company: cleanText(person.company),
        companyId: cleanText(person.companyId || person.companySlug),
        region: cleanText(person.region),
        size: cleanText(person.size),
        fit: Number(person.fit) || 0,
        timing: Number(person.timing) || 0,
        timingSignals: Array.isArray(person.timingSignals) ? person.timingSignals.slice(0, 6).map((signal) => ({
          type: cleanText(signal?.type),
          detail: cleanText(signal?.detail),
          sourceIds: Array.isArray(signal?.sourceIds) ? signal.sourceIds.map(cleanText).filter(Boolean).slice(0, 3) : []
        })) : [],
        class: cleanText(person.class),
        trendQualified: Boolean(person.trendQualified),
        exclusionReasons: Array.isArray(person.exclusionReasons) ? person.exclusionReasons.map(cleanText).slice(0, 6) : [],
        sources: Array.isArray(person.sources) ? person.sources.slice(0, 12) : []
      })).filter((person) => person.id)
    : [];
  const existingEvidence = Array.isArray(body.existingEvidence)
    ? body.existingEvidence.slice(0, 1000).filter((item) => item && typeof item === "object").map((item) => ({
        id: cleanText(item.id),
        sourceId: cleanText(item.sourceId),
        personId: cleanText(item.personId),
        companyId: cleanText(item.companyId),
        subjectName: cleanText(item.subjectName),
        type: cleanText(item.type),
        url: absoluteLinkedInUrl(item.url),
        excerpt: cleanText(item.excerpt),
        publishedAt: item.publishedAt ? cleanText(item.publishedAt) : null,
        ageDays: item.ageDays != null && Number.isFinite(Number(item.ageDays)) ? Number(item.ageDays) : null,
        retrievedAt: cleanText(item.retrievedAt),
        matchedTerms: Array.isArray(item.matchedTerms) ? item.matchedTerms.map(cleanText).slice(0, 20) : [],
        themeIds: Array.isArray(item.themeIds) ? item.themeIds.map(cleanText).slice(0, 10) : []
      })).filter((item) => item.id && item.excerpt)
    : [];
  return {
    keywords,
    location,
    batchSize: Math.max(1, Math.min(10, Number(body.batchSize) || 3)),
    excludeUsernames,
    sourceOffset: Math.max(0, Math.min(999, Number(body.sourceOffset) || 0)),
    existingPeople,
    existingEvidence,
    windowDays: 30,
    trendQuery: cleanText(body.trendQuery) || "revenue operations forecasting",
    context: {
      offer: cleanText(context.offer) || "We help B2B revenue teams make forecasting evidence easier to review.",
      role,
      market,
      region: cleanText(context.region) || "London"
    }
  };
}

async function serveStatic(req, res, pathname) {
  const relative = pathname === "/" ? "signal.html" : decodeURIComponent(pathname.slice(1));
  const candidate = resolve(ROOT, normalize(relative));
  if (!candidate.startsWith(`${ROOT}/`) && candidate !== join(ROOT, "signal.html")) return json(res, 403, { error: "Forbidden" });
  try {
    const info = await stat(candidate);
    if (!info.isFile()) return json(res, 404, { error: "Not found" });
    const content = await readFile(candidate);
    const types = { ".html": "text/html; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".json": "application/json; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8" };
    res.writeHead(200, {
      "Content-Type": types[extname(candidate)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; frame-ancestors 'none'"
    });
    res.end(content);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/status") {
      if (url.searchParams.get("verify") === "1") {
        const result = await callTool("get_my_profile", {}, null, { allowVerify: true });
        const hasData = Boolean(result?.url || getSection(result).trim());
        connection.verified = hasData;
        connection.verifiedAt = hasData ? new Date().toISOString() : null;
        connection.message = hasData ? "LinkedIn connected with a successful live read." : "LinkedIn returned no profile data. Sign in and retry.";
      }
      return json(res, 200, { ...connection, localOnly: true });
    }

    if (req.method === "POST" && url.pathname === "/api/runs") {
      if (!connection.verified) return json(res, 409, { error: "Live LinkedIn has not passed a verification read.", action: "Open Setup & Context and run the connection check." });
      const body = await readBody(req);
      const run = {
        id: randomUUID(),
        input: validateRunInput(body),
        sequence: 0,
        history: [],
        clients: new Set(),
        cancelled: false,
        currentChild: null
      };
      runs.set(run.id, run);
      json(res, 202, { runId: run.id, input: run.input });
      setImmediate(() => runResearch(run));
      return;
    }

    const eventMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/events$/);
    if (req.method === "GET" && eventMatch) {
      const run = runs.get(eventMatch[1]);
      if (!run) return json(res, 404, { error: "Run not found" });
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
      });
      res.write(": connected\n\n");
      for (const event of run.history) res.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      run.clients.add(res);
      req.on("close", () => run.clients.delete(res));
      return;
    }

    const cancelMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelMatch) {
      const run = runs.get(cancelMatch[1]);
      if (!run) return json(res, 404, { error: "Run not found" });
      run.cancelled = true;
      if (run.currentChild && !run.currentChild.killed) run.currentChild.kill("SIGTERM");
      return json(res, 202, { cancelled: true });
    }

    if (url.pathname.startsWith("/api/")) return json(res, 404, { error: "API route not found" });
    return serveStatic(req, res, url.pathname);
  } catch (error) {
    json(res, 500, { error: safeMessage(error) });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`LinkedIn Signal Analyser running at http://${HOST}:${PORT}\n`);
  process.stdout.write("Authenticate once with: uvx mcp-server-linkedin@latest --login\n");
});

function shutdown() {
  for (const run of runs.values()) {
    run.cancelled = true;
    if (run.currentChild && !run.currentChild.killed) run.currentChild.kill("SIGTERM");
  }
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
