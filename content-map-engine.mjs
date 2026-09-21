const FORMAT_LIBRARY = {
  "Carousel": "Best for a sequence, checklist, or framework people may save and reuse.",
  "Text post": "Best for a sharp point of view with enough context to earn a thoughtful response.",
  "Poll": "Best for testing a clear choice after the evidence has defined the options.",
  "Short video": "Best for demonstrating a workflow or explaining a nuanced change in plain language.",
  "Single image": "Best for making one launch, model, or before-and-after contrast instantly legible."
};

const TYPE_PLANS = [
  {
    test: /question/i,
    pillar: "Authority",
    goal: "Saves",
    formula: "F15 · Explain-to-Kids",
    formats: [["Carousel", 94], ["Short video", 82], ["Poll", 68]],
    ctaType: "Experience question"
  },
  {
    test: /complaint/i,
    pillar: "Authority",
    goal: "Comments",
    formula: "F10 · Contrarian + receipts",
    formats: [["Text post", 93], ["Carousel", 79], ["Poll", 61]],
    ctaType: "Specific diagnostic question"
  },
  {
    test: /launch/i,
    pillar: "Product / Offer",
    goal: "Reposts",
    formula: "F20 · Diverging-curves close",
    formats: [["Single image", 89], ["Short video", 85], ["Text post", 72]],
    ctaType: "Implementation question"
  },
  {
    test: /company change/i,
    pillar: "Personal Narrative",
    goal: "Comments",
    formula: "F19 · Anecdote-meets-evidence",
    formats: [["Text post", 91], ["Short video", 81], ["Carousel", 69]],
    ctaType: "Reflection question"
  },
  {
    test: /.*/,
    pillar: "Community",
    goal: "Reposts",
    formula: "F18 · False-binary dissolve",
    formats: [["Text post", 88], ["Carousel", 76], ["Short video", 72]],
    ctaType: "Peer practice question"
  }
];

const FORMULA_FALLBACKS = [
  "F17 · Controlled A/B anecdote",
  "F7 · Odd-precision ledger",
  "F18 · False-binary dissolve",
  "F19 · Anecdote-meets-evidence"
];

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function trimSentence(value) {
  return String(value || "").trim().replace(/[.\s]+$/, "");
}

function metricsFor(theme) {
  const metrics = theme?.metrics || {};
  return {
    mentions: number(metrics.mentions ?? theme?.count),
    uniqueSources: number(metrics.uniqueSources ?? theme?.count),
    distinctPeople: number(metrics.distinctPeople),
    distinctCompanies: number(metrics.distinctCompanies),
    evidenceIds: Array.isArray(metrics.evidenceIds) ? metrics.evidenceIds : (Array.isArray(theme?.evidenceIds) ? theme.evidenceIds : [])
  };
}

function selectPlan(type) {
  return TYPE_PLANS.find((plan) => plan.test.test(String(type || ""))) || TYPE_PLANS.at(-1);
}

function readiness(metrics, contributorShare) {
  const represented = metrics.distinctPeople + metrics.distinctCompanies;
  const blockers = [];
  if (metrics.uniqueSources < 2) blockers.push("Only one independent source");
  if (represented < 2) blockers.push("Narrow contributor mix");
  if (contributorShare > 0.5) blockers.push("One contributor supplies over half the signal");
  if (metrics.uniqueSources >= 3 && represented >= 3 && contributorShare <= 0.5) {
    return { score: 90, label: "Ready to draft", blockers };
  }
  if (metrics.uniqueSources >= 2) return { score: 72, label: "Develop with proof", blockers };
  return { score: 48, label: "Needs more evidence", blockers };
}

function hookDraft(theme, plan, metrics) {
  const label = String(theme.label || "this workflow").toLowerCase();
  const countLead = metrics.uniqueSources >= 2 ? `Across ${metrics.uniqueSources} public source receipts, ` : "In this qualified sample, ";
  if (/F15/.test(plan.formula)) return `${countLead}${label} keeps breaking for the same avoidable reason. Here is the simplest way to audit it.`;
  if (/F10/.test(plan.formula)) return `${countLead}the usual advice on ${label} is treating the symptom, not the system.`;
  if (/F20/.test(plan.formula)) return `${countLead}two approaches to ${label} are starting to move in opposite directions.`;
  if (/F19/.test(plan.formula)) return `I kept noticing the same ${label} problem. The source receipts suggest it is a system issue, not an isolated miss.`;
  if (/F17/.test(plan.formula)) return `We compared two ways of handling ${label}. One small process change made the difference visible.`;
  if (/F7/.test(plan.formula)) return `${metrics.uniqueSources || 1} source receipt${metrics.uniqueSources === 1 ? "" : "s"}. One recurring ${label} failure. A clearer operating rule.`;
  return `${countLead}${label} is not a choice between automation and control. The evidence points to a third option.`;
}

function structureFor(theme, plan) {
  const label = String(theme.label || "the issue");
  if (plan.formats[0][0] === "Carousel") {
    return [
      `Name the repeated ${label.toLowerCase()} problem`,
      "Show the 3-step check or framework",
      "Use one anonymised source pattern as an example",
      "Close with the decision the reader can make next"
    ];
  }
  if (plan.formats[0][0] === "Single image") {
    return [
      `Visualise the old and new ${label.toLowerCase()} path`,
      "Explain what changed and why it matters",
      "Add the control or trade-off the announcement leaves out",
      "Close with an implementation question"
    ];
  }
  return [
    `Open with the evidence-backed tension around ${label.toLowerCase()}`,
    "State the common assumption you disagree with",
    "Explain the operating mechanism and one concrete example",
    "Close with a narrow question practitioners can answer"
  ];
}

function ctaDraft(theme, type) {
  const label = String(theme.label || "this workflow").toLowerCase();
  if (/diagnostic/i.test(type)) return `Where does ${label} actually fail in your process: ownership, timing, or evidence?`;
  if (/implementation/i.test(type)) return `What would you need to verify before adopting this approach to ${label}?`;
  if (/reflection/i.test(type)) return `What changed your view on ${label}?`;
  if (/peer/i.test(type)) return `How is your team balancing speed and control around ${label}?`;
  return `Which part of ${label} is hardest to explain inside your team?`;
}

function scoreFormats(plan, metrics) {
  const evidencePenalty = metrics.uniqueSources < 2 ? 12 : 0;
  return plan.formats.map(([name, score], index) => ({
    name,
    score: Math.max(35, score - (index === 2 ? evidencePenalty : 0)),
    reason: FORMAT_LIBRARY[name]
  }));
}

export function buildContentMap(themes = [], { limit = 4 } = {}) {
  const usedFormulas = new Set();
  let productUsed = false;
  return themes.slice(0, limit).map((theme, index) => {
    const metrics = metricsFor(theme);
    let plan = { ...selectPlan(theme.type) };
    if (plan.pillar === "Product / Offer" && productUsed) plan = { ...TYPE_PLANS.at(-1) };
    if (plan.pillar === "Product / Offer") productUsed = true;
    if (usedFormulas.has(plan.formula)) {
      plan.formula = FORMULA_FALLBACKS.find((formula) => !usedFormulas.has(formula)) || plan.formula;
    }
    usedFormulas.add(plan.formula);
    const topContributorShare = number(theme.topContributorShare ?? theme.metrics?.topContributorShare);
    const quality = readiness(metrics, topContributorShare);
    const formats = scoreFormats(plan, metrics);
    const angle = trimSentence(theme.contentAngle || theme.interpretation || theme.summary || `Explain what the ${theme.label || "observed"} signal means in practice`);
    const risk = topContributorShare > 0.5
      ? "Contributor concentration is high. Frame this as a sampled observation, not a market-wide conclusion."
      : metrics.uniqueSources < 3
        ? "The sample is still small. Keep the claim narrow and name the limits."
        : "Keep every claim inside the observed sample and separate evidence from interpretation.";
    return {
      id: `content-${theme.id || index + 1}`,
      themeId: theme.id || "",
      title: angle,
      pillar: plan.pillar,
      recommendedFormat: formats[0].name,
      formats,
      goal: plan.goal,
      hook: { formula: plan.formula, draft: hookDraft(theme, plan, metrics) },
      cta: { type: plan.ctaType, draft: ctaDraft(theme, plan.ctaType) },
      structure: structureFor(theme, plan),
      evidence: metrics,
      readiness: quality,
      proofNeeded: `Add one firsthand example, screenshot, or operating number that demonstrates ${String(theme.label || "the signal").toLowerCase()} without exposing a person or company.`,
      risk,
      meta: `Theme: ${theme.label || "Observed signal"} · ${metrics.uniqueSources} unique source${metrics.uniqueSources === 1 ? "" : "s"} · Human review required`
    };
  });
}

