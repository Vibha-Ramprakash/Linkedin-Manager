import test from "node:test";
import assert from "node:assert/strict";
import { buildContentMap } from "./content-map-engine.mjs";

function theme(overrides = {}) {
  return {
    id: "forecast",
    label: "Forecast trust",
    type: "Repeated question",
    contentAngle: "Show the checks that make a forecast defensible before the weekly call.",
    metrics: { mentions: 5, uniqueSources: 4, distinctPeople: 3, distinctCompanies: 2, evidenceIds: ["E1", "E2"] },
    topContributorShare: 0.4,
    ...overrides
  };
}

test("repeated questions become save-led carousel recommendations", () => {
  const [idea] = buildContentMap([theme()]);
  assert.equal(idea.recommendedFormat, "Carousel");
  assert.equal(idea.goal, "Saves");
  assert.match(idea.hook.formula, /F15/);
  assert.equal(idea.readiness.label, "Ready to draft");
});

test("complaints become comment-led text posts", () => {
  const [idea] = buildContentMap([theme({ type: "Repeated complaint" })]);
  assert.equal(idea.recommendedFormat, "Text post");
  assert.equal(idea.goal, "Comments");
  assert.match(idea.hook.formula, /F10/);
});

test("one plan never schedules more than one product or offer post", () => {
  const ideas = buildContentMap([
    theme({ id: "a", type: "Launch" }),
    theme({ id: "b", type: "Launch" })
  ]);
  assert.equal(ideas.filter((idea) => idea.pillar === "Product / Offer").length, 1);
});

test("a plan avoids repeating hook formulae", () => {
  const ideas = buildContentMap([
    theme({ id: "a", type: "Repeated complaint" }),
    theme({ id: "b", type: "Repeated complaint" })
  ]);
  assert.notEqual(ideas[0].hook.formula, ideas[1].hook.formula);
});

test("small or concentrated samples expose proof blockers", () => {
  const [idea] = buildContentMap([theme({
    metrics: { mentions: 1, uniqueSources: 1, distinctPeople: 1, distinctCompanies: 0, evidenceIds: ["E1"] },
    topContributorShare: 1
  })]);
  assert.equal(idea.readiness.label, "Needs more evidence");
  assert.ok(idea.readiness.blockers.length >= 2);
  assert.match(idea.risk, /sampled observation/i);
});

test("hooks use only evidence-backed counts and never open with a question", () => {
  const [idea] = buildContentMap([theme()]);
  assert.match(idea.hook.draft, /4 public source receipts/);
  assert.equal(idea.hook.draft.trim().startsWith("?"), false);
  assert.deepEqual(idea.evidence.evidenceIds, ["E1", "E2"]);
});
