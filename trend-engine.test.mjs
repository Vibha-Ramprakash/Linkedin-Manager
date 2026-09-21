import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTrendReport,
  createEvidenceItems,
  dedupeEvidence,
  parseAgeDays,
  scoreQualifiedPerson
} from "./trend-engine.mjs";

const retrievedAt = "2026-09-19T12:00:00.000Z";

function qualifiedPerson(overrides = {}) {
  return scoreQualifiedPerson({
    id: "p1",
    role: "Head of Revenue Operations",
    company: "Northstar Labs",
    companyId: "northstar",
    companyAbout: "B2B SaaS software for revenue teams. 180 employees.",
    region: "London, United Kingdom",
    size: "180 employees",
    personPostsText: "We are fixing forecast confidence and CRM hygiene.",
    companyPostsText: "Our pipeline launch is live.",
    promoted: false,
    sources: [{ id: "SRC-P1" }, { id: "SRC-C1" }],
    evidenceItems: [],
    ...overrides
  }, { role: "Head of RevOps", market: "B2B SaaS" });
}

function postEvidence({ sourceId, personId, companyId, url, text }) {
  return createEvidenceItems({
    sourceId,
    personId,
    companyId,
    subjectName: personId || companyId || "Market search",
    type: personId ? "person_post" : "market_post",
    url,
    text,
    retrievedAt
  });
}

test("parses LinkedIn relative dates into real day buckets", () => {
  assert.equal(parseAgeDays("Posted 6 hours ago"), 0);
  assert.equal(parseAgeDays("3 days ago"), 3);
  assert.equal(parseAgeDays("2 weeks ago"), 14);
  assert.equal(parseAgeDays("2 months ago"), 60);
  assert.equal(parseAgeDays("date unavailable"), null);
});

test("deduplicates by canonical URL, source type, and normalized excerpt", () => {
  const first = postEvidence({ sourceId: "S1", personId: "p1", companyId: "c1", url: "https://www.linkedin.com/posts/a?trk=feed", text: "2 days ago\nForecast confidence is falling because CRM updates arrive late." });
  const second = postEvidence({ sourceId: "S2", personId: "p1", companyId: "c1", url: "https://www.linkedin.com/posts/a", text: "2 days ago  Forecast confidence is falling because CRM updates arrive late." });
  assert.equal(dedupeEvidence([...first, ...second]).length, 1);
});

test("qualifies only supported role and company matches at fit 65 or above", () => {
  const qualified = qualifiedPerson();
  const irrelevant = qualifiedPerson({
    id: "p2",
    role: "Customer Success Manager",
    companyAbout: "Consumer furniture retailer.",
    personPostsText: "Forecast and pipeline are interesting topics."
  });
  assert.equal(qualified.trendQualified, true);
  assert.equal(qualified.fit, 100);
  assert.equal(irrelevant.trendQualified, false);
  assert.ok(irrelevant.exclusionReasons.some((reason) => reason.includes("role")));
  assert.ok(irrelevant.exclusionReasons.some((reason) => reason.includes("company")));
});

test("excludes irrelevant profiles, buckets dates, and calculates source diversity", () => {
  const p1 = qualifiedPerson();
  const p2 = qualifiedPerson({ id: "p2", companyId: "c2", company: "Second SaaS", sources: [{ id: "S2" }] });
  const excluded = qualifiedPerson({ id: "p3", role: "Designer", companyAbout: "Consumer retail", region: "Paris" });
  const evidence = [
    ...postEvidence({ sourceId: "S1", personId: "p1", companyId: "northstar", url: "https://www.linkedin.com/posts/one", text: "3 days ago\nHow can we trust forecast confidence when CRM updates are late?" }),
    ...postEvidence({ sourceId: "S2", personId: "p2", companyId: "c2", url: "https://www.linkedin.com/posts/two", text: "12 days ago\nOur forecast accuracy still depends on manual CRM work." }),
    ...postEvidence({ sourceId: "S3", personId: "p3", companyId: "c3", url: "https://www.linkedin.com/posts/three", text: "2 days ago\nForecast confidence and CRM data quality remain hard." })
  ];
  const report = buildTrendReport({ people: [p1, p2, excluded], evidence, periodDays: 30 });
  const forecast = report.themes.find((theme) => theme.id === "forecast");
  assert.equal(report.cohort.collected, 3);
  assert.equal(report.cohort.qualified, 2);
  assert.equal(report.cohort.excluded, 1);
  assert.equal(forecast.periods["7"].mentions, 1);
  assert.equal(forecast.periods["14"].mentions, 2);
  assert.equal(forecast.periods["30"].uniqueSources, 2);
  assert.equal(forecast.periods["30"].distinctPeople, 2);
});

test("appended results merge as evidence sets and never add previous aggregates", () => {
  const p1 = qualifiedPerson();
  const duplicate = postEvidence({ sourceId: "S1", personId: "p1", companyId: "northstar", url: "https://www.linkedin.com/posts/same", text: "1 week ago\nForecast accuracy needs better CRM evidence." });
  const first = buildTrendReport({ people: [p1], evidence: duplicate, periodDays: 30 });
  const appended = buildTrendReport({ people: [p1], evidence: [...first.evidence, ...duplicate], periodDays: 30 });
  assert.equal(first.evidence.length, 1);
  assert.equal(appended.evidence.length, 1);
  assert.equal(appended.themes.find((theme) => theme.id === "forecast").metrics.mentions, 1);
});

test("undated evidence stays visible in quality but is excluded from 7/14/30 totals", () => {
  const p1 = qualifiedPerson();
  const evidence = postEvidence({ sourceId: "S1", personId: "p1", companyId: "northstar", url: "https://www.linkedin.com/posts/undated", text: "Forecast accuracy depends on CRM confidence." });
  const report = buildTrendReport({ people: [p1], evidence, periodDays: 30 });
  assert.equal(report.cohort.undatedEvidence, 1);
  assert.equal(report.cohort.datedEvidence, 0);
  assert.equal(report.themes.length, 0);
});

test("zero qualified profiles produce zero themes, including from market posts", () => {
  const excluded = qualifiedPerson({ id: "p3", role: "Designer", companyAbout: "Consumer retail", region: "Paris" });
  const marketEvidence = postEvidence({ sourceId: "MARKET-1", personId: "", companyId: "", url: "https://www.linkedin.com/posts/market", text: "2 days ago\nForecast accuracy and CRM data quality are changing." });
  const report = buildTrendReport({ people: [excluded], evidence: marketEvidence, periodDays: 30 });
  assert.equal(report.cohort.qualified, 0);
  assert.equal(report.themes.length, 0);
  assert.equal(report.evidence.length, 0);
});

test("dominant contributor share is calculated from deduplicated evidence", () => {
  const p1 = qualifiedPerson();
  const p2 = qualifiedPerson({ id: "p2", companyId: "c2", company: "Second SaaS" });
  const evidence = [
    ...postEvidence({ sourceId: "S1", personId: "p1", companyId: "northstar", url: "https://www.linkedin.com/posts/a", text: "1 day ago\nForecast confidence is unclear." }),
    ...postEvidence({ sourceId: "S2", personId: "p1", companyId: "northstar", url: "https://www.linkedin.com/posts/b", text: "2 days ago\nForecast accuracy needs evidence." }),
    ...postEvidence({ sourceId: "S3", personId: "p2", companyId: "c2", url: "https://www.linkedin.com/posts/c", text: "3 days ago\nForecast confidence needs work." })
  ];
  const report = buildTrendReport({ people: [p1, p2], evidence, periodDays: 30 });
  assert.equal(report.themes.find((theme) => theme.id === "forecast").topContributorShare, 2 / 3);
});

test("26 receipts remain 26 unique evidence items after duplicate additive input", () => {
  const p1 = qualifiedPerson();
  const receipts = Array.from({ length: 26 }, (_, index) => postEvidence({
    sourceId: `S${index + 1}`,
    personId: "p1",
    companyId: "northstar",
    url: `https://www.linkedin.com/posts/receipt-${index + 1}`,
    text: `${(index % 20) + 1} days ago\nForecast confidence evidence number ${index + 1}.`
  })[0]);
  const report = buildTrendReport({ people: [p1], evidence: [...receipts, ...receipts], periodDays: 30 });
  assert.equal(report.evidence.length, 26);
  assert.equal(report.cohort.uniqueSources, 26);
  assert.equal(report.themes.find((theme) => theme.id === "forecast").metrics.mentions, 26);
});
