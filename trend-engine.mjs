import { createHash } from "node:crypto";

export const THEME_RULES = [
  {
    id: "forecast",
    label: "Forecast trust",
    type: "Repeated question",
    terms: ["forecast", "accuracy", "confidence", "predict"],
    contentAngle: "Show the checks that make a forecast defensible before the weekly call."
  },
  {
    id: "hygiene",
    label: "CRM data quality",
    type: "Repeated complaint",
    terms: ["crm", "data quality", "data hygiene", "manual update"],
    contentAngle: "Reframe CRM hygiene as a workflow-design problem instead of a policing problem."
  },
  {
    id: "ai",
    label: "AI workflow adoption",
    type: "Industry change",
    terms: ["ai", "automation", "copilot", "agent"],
    contentAngle: "Explain the human approval and evidence layer required for responsible AI adoption."
  },
  {
    id: "product-launch",
    label: "Product launches",
    type: "Launch",
    terms: ["launched", "announced", "introducing", "released", "rollout", "now available", "new feature", "new product"],
    contentAngle: "Compare what the observed launches make easier, while keeping announcement, adoption, and outcome as separate claims."
  },
  {
    id: "handoff",
    label: "Pipeline handoffs",
    type: "Repeated complaint",
    terms: ["handoff", "pipeline", "alignment", "marketing and sales"],
    contentAngle: "Turn the recurring handoff problem into a practical cross-functional checklist."
  },
  {
    id: "growth",
    label: "Team and market changes",
    type: "Company change",
    terms: ["launch", "hiring", "expansion", "promotion", "new role"],
    contentAngle: "Show how teams can keep revenue definitions stable during launches, hiring, and expansion."
  },
  {
    id: "market-shift",
    label: "Revenue operating model shifts",
    type: "Market change",
    terms: ["go-to-market", "revenue operations", "revops", "buyer process", "budget cycle", "data access", "human approval"],
    contentAngle: "Explain the operating change visible in the sample and name what still needs a wider market check."
  }
];

const TREND_TYPES = new Set(["person_post", "company_post", "market_post"]);

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function canonicalUrl(value) {
  try {
    const url = new URL(value, "https://www.linkedin.com");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(trk|trackingId|lipi|midToken|eBP)$/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return "";
  }
}

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function hasTerm(text, term) {
  const normalizedText = clean(text).toLowerCase();
  const normalizedTerm = clean(term).toLowerCase();
  if (!normalizedText || !normalizedTerm) return false;
  if (/^[a-z0-9]+$/.test(normalizedTerm)) {
    return new RegExp(`(^|[^a-z0-9])${normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
}

function relevantExcerpt(text, terms = []) {
  const normalized = clean(text);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  const positions = terms.map((term) => lower.indexOf(term.toLowerCase())).filter((index) => index >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - 90);
  const end = Math.min(normalized.length, start + 300);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
}

export function parseAgeDays(text) {
  const value = String(text || "");
  const patterns = [
    { regex: /\b(\d+)\s*(?:h|hours?\s+ago)\b/i, multiplier: 0 },
    { regex: /\b(\d+)\s*(?:d|days?\s+ago)\b/i, multiplier: 1 },
    { regex: /\b(\d+)\s*(?:w|weeks?\s+ago)\b/i, multiplier: 7 },
    { regex: /\b(\d+)\s*(?:mo|months?\s+ago)\b/i, multiplier: 30 }
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern.regex);
    if (match) return Number(match[1]) * pattern.multiplier;
  }
  return null;
}

function splitPostText(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const numbered = raw.split(/(?=Feed post number\s+\d+)/i).map((part) => part.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered.slice(0, 20);
  const blocks = raw.split(/\n{3,}/).map((part) => part.trim()).filter((part) => part.length >= 40);
  return (blocks.length ? blocks : [raw]).slice(0, 20);
}

export function createEvidenceItems({
  sourceId,
  personId = "",
  companyId = "",
  subjectName = "",
  type,
  url,
  text,
  retrievedAt = new Date().toISOString()
}) {
  const segments = TREND_TYPES.has(type) ? splitPostText(text) : [String(text || "").trim()];
  return segments.filter(Boolean).map((segment) => {
    const matchedThemes = THEME_RULES.filter((rule) =>
      rule.terms.some((term) => hasTerm(segment, term))
    );
    const matchedTerms = [...new Set(matchedThemes.flatMap((rule) =>
      rule.terms.filter((term) => hasTerm(segment, term))
    ))];
    const canonical = canonicalUrl(url);
    const excerpt = relevantExcerpt(segment, matchedTerms);
    const evidenceKey = `${canonical}|${type}|${excerpt.toLowerCase()}`;
    const ageDays = parseAgeDays(segment);
    const publishedAt = ageDays == null
      ? null
      : new Date(new Date(retrievedAt).getTime() - ageDays * 86400000).toISOString();
    return {
      id: `EV-${shortHash(evidenceKey)}`,
      sourceId,
      personId,
      companyId,
      subjectName: clean(subjectName),
      type,
      url: canonical,
      excerpt,
      publishedAt,
      ageDays,
      retrievedAt,
      matchedTerms,
      themeIds: matchedThemes.map((rule) => rule.id)
    };
  });
}

export function dedupeEvidence(items = []) {
  const byId = new Map();
  for (const item of items) {
    if (!item?.id || !item?.excerpt) continue;
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function parseEmployeeCount(size) {
  const matches = String(size || "").match(/[\d,.]+/g);
  if (!matches?.length) return null;
  return Number(matches[0].replace(/,/g, ""));
}

export function scoreQualifiedPerson(person, context = {}) {
  const role = clean(person.role).toLowerCase();
  const companyEvidence = clean(person.companyAbout).toLowerCase();
  const region = clean(person.region).toLowerCase();
  const postEvidence = clean(`${person.personPostsText || ""} ${person.companyPostsText || ""}`).toLowerCase();

  const strongRole = /revenue operations|revops|head of gtm|vp\s+(?:of\s+)?sales|vice president\s+(?:of\s+)?sales|head of sales|sales director|chief revenue|\bcro\b/.test(role);
  const adjacentRole = /sales|revenue|growth|go-to-market|\bgtm\b/.test(role);
  const roleScore = strongRole ? 30 : adjacentRole ? 18 : 0;

  const marketMatch = /\bb2b\b|\bsaas\b|software|cloud|technology|cybersecurity|fintech/.test(companyEvidence);
  const employeeCount = parseEmployeeCount(person.size);
  const sizeMatch = employeeCount == null || (employeeCount >= 50 && employeeCount <= 500);
  const companyScore = marketMatch ? (sizeMatch ? 25 : 18) : 0;

  const regionScore = /london|united kingdom|england|berlin|munich|germany|dach|zurich|vienna|europe/.test(region) ? 20 : 0;
  const problemScore = /forecast|crm|pipeline|revenue intelligence|sales planning|revops/.test(postEvidence) ? 25 : 0;
  const fit = roleScore + companyScore + regionScore + problemScore;

  let timing = 0;
  if (person.promoted) timing += 25;
  if (/launch|announc|expansion|initiative|hiring/.test(postEvidence)) timing += 30;
  if (/forecast|crm|pipeline|revenue operations|revops/.test(postEvidence)) timing += 25;
  timing = Math.min(100, timing);

  const timingSignals = [];
  const timingSourceIds = (pattern) => (person.evidenceItems || [])
    .filter((item) => pattern.test(clean(item.excerpt).toLowerCase()))
    .map((item) => item.sourceId)
    .filter(Boolean)
    .slice(0, 3);
  if (person.promoted) {
    timingSignals.push({
      type: "Role change",
      detail: "Public profile activity indicates a recent promotion or new role.",
      sourceIds: person.sources?.slice(0, 1).map((source) => source.id).filter(Boolean) || []
    });
  }
  if (/expansion|new market|new region|opened\s+(?:an?\s+)?office/.test(postEvidence)) {
    timingSignals.push({
      type: "Company expansion",
      detail: "Recent company activity indicates a market, regional, or office expansion.",
      sourceIds: timingSourceIds(/expansion|new market|new region|opened\s+(?:an?\s+)?office/)
    });
  }
  if (/launch|announc|released|rollout|now available|new product|new feature|new workflow/.test(postEvidence)) {
    timingSignals.push({
      type: "Product launch",
      detail: "Recent public activity contains an explicit product, feature, or workflow announcement.",
      sourceIds: timingSourceIds(/launch|announc|released|rollout|now available|new product|new feature|new workflow/)
    });
  }
  if (/hiring|headcount|team growth/.test(postEvidence)) {
    timingSignals.push({
      type: "Hiring change",
      detail: "Recent public activity indicates active hiring or team growth.",
      sourceIds: timingSourceIds(/hiring|headcount|team growth/)
    });
  }

  const exclusionReasons = [];
  if (!strongRole) exclusionReasons.push(roleScore ? "role is adjacent to the saved ICP" : "current role does not match the saved ICP");
  if (!marketMatch) exclusionReasons.push("company evidence does not support the saved market");
  if (fit < 65) exclusionReasons.push("fit score is below 65");
  const trendQualified = fit >= 65 && strongRole && marketMatch;

  return {
    ...person,
    fit,
    timing,
    timingSignals,
    class: fit >= 75 ? "Priority review" : fit >= 55 ? "Possible" : "Not now",
    fitBreakdown: {
      role: { score: roleScore, max: 30, supported: strongRole, sourceIds: person.sources?.slice(0, 1).map((source) => source.id) || [] },
      company: { score: companyScore, max: 25, supported: marketMatch, sourceIds: person.sources?.slice(-1).map((source) => source.id) || [] },
      region: { score: regionScore, max: 20, supported: regionScore > 0, sourceIds: person.sources?.slice(0, 1).map((source) => source.id) || [] },
      problem: { score: problemScore, max: 25, supported: problemScore > 0, sourceIds: (person.evidenceItems || []).filter((item) => TREND_TYPES.has(item.type)).map((item) => item.sourceId).slice(0, 3) }
    },
    trendQualified,
    exclusionReasons,
    contextLabel: `${context.role || "Saved role"} · ${context.market || "Saved market"}`
  };
}

function metricsFor(rule, evidence, days) {
  const matching = evidence.filter((item) =>
    item.themeIds?.includes(rule.id) && item.ageDays != null && item.ageDays <= days
  );
  const subjects = new Map();
  for (const item of matching) {
    const key = item.personId || item.companyId || item.sourceId;
    subjects.set(key, (subjects.get(key) || 0) + 1);
  }
  const topCount = Math.max(0, ...subjects.values());
  return {
    mentions: matching.length,
    uniqueSources: new Set(matching.map((item) => item.url || item.sourceId)).size,
    distinctPeople: new Set(matching.map((item) => item.personId).filter(Boolean)).size,
    distinctCompanies: new Set(matching.map((item) => item.companyId).filter(Boolean)).size,
    evidenceIds: matching.map((item) => item.id),
    topContributorShare: matching.length ? topCount / matching.length : 0
  };
}

export function buildTrendReport({ people = [], evidence = [], periodDays = 30, provisional = false } = {}) {
  const uniqueEvidence = dedupeEvidence(evidence);
  const qualifiedPeople = people.filter((person) => person.trendQualified);
  const qualifiedIds = new Set(qualifiedPeople.map((person) => person.id));
  const eligibleEvidence = qualifiedPeople.length
    ? uniqueEvidence.filter((item) => TREND_TYPES.has(item.type) && (item.type === "market_post" || qualifiedIds.has(item.personId)))
    : [];
  const matchedEvidence = eligibleEvidence.filter((item) => item.themeIds?.length);
  const periods = [7, 14, 30];
  const themes = THEME_RULES.map((rule) => {
    const periodMetrics = Object.fromEntries(periods.map((days) => [String(days), metricsFor(rule, matchedEvidence, days)]));
    const metrics = periodMetrics[String(periodDays)] || periodMetrics["30"];
    const coverage = metrics.distinctPeople + metrics.distinctCompanies;
    const interpretation = metrics.uniqueSources >= 3 && coverage >= 3
      ? `This signal recurs across ${metrics.uniqueSources} independent source receipts and ${coverage} represented people or companies.`
      : "This is an early signal in the qualified sample and should be tested cautiously before making a broader market claim.";
    return {
      id: rule.id,
      label: rule.label,
      type: rule.type,
      metrics,
      periods: periodMetrics,
      evidenceIds: periodMetrics["30"].evidenceIds,
      topContributorShare: metrics.topContributorShare,
      interpretation,
      contentAngle: rule.contentAngle
    };
  }).filter((theme) => theme.metrics.mentions > 0)
    .sort((a, b) => b.metrics.uniqueSources - a.metrics.uniqueSources || b.metrics.mentions - a.metrics.mentions);

  const exclusionCounts = new Map();
  for (const person of people.filter((item) => !item.trendQualified)) {
    for (const reason of person.exclusionReasons || ["not qualified"]) {
      exclusionCounts.set(reason, (exclusionCounts.get(reason) || 0) + 1);
    }
  }

  return {
    provisional,
    periodDays,
    cohort: {
      collected: people.length,
      qualified: qualifiedPeople.length,
      excluded: people.length - qualifiedPeople.length,
      exclusionReasons: [...exclusionCounts].map(([reason, count]) => ({ reason, count })),
      uniqueSources: new Set(eligibleEvidence.map((item) => item.url || item.sourceId)).size,
      datedEvidence: eligibleEvidence.filter((item) => item.ageDays != null).length,
      undatedEvidence: eligibleEvidence.filter((item) => item.ageDays == null).length
    },
    themes,
    evidence: eligibleEvidence
  };
}
