# LinkedIn Signal Analyser QA Report

Date: 21 September 2026

## Result

The Evidence-First Trend Scanner and its required live-data foundation pass deterministic unit, localhost integration, browser, responsive, and accessibility checks. The user’s authenticated LinkedIn route previously completed real reads; because the new v2 evidence model deliberately does not reuse the v1 snapshot, the upgraded interface correctly asks for one fresh live run before showing evidence coverage from that account.

## Evidence model

- Every inspected record is normalized with an evidence ID, source ID, person/company IDs, type, canonical URL, excerpt, date or age when available, retrieval time, matched terms, and theme IDs.
- Evidence is deduplicated by canonical URL, source type, and normalized excerpt.
- Additive runs send the existing evidence set back to the localhost bridge and recompute all aggregates. Previous counts are never added to new counts.
- Undated evidence remains visible in sample quality and is excluded from 7/14/30-day totals.
- Unique-evidence labels use deduplicated evidence IDs, not the sum of overlapping theme mentions.
- Each evidence card rendered in the browser had a non-empty direct source URL and retrieval time.

## Cohort qualification

- Role points use only the normalized current role.
- Company/market points use only the company-profile evidence.
- Region points use only the normalized location.
- Problem-relevance points use only post evidence.
- Trend qualification requires fit ≥65, a supported role match, and a supported company/market match.
- The integration fixture collected three profiles, qualified two, excluded one, and surfaced all three exclusion reasons for the irrelevant profile.
- Posts belonging to the excluded profile did not influence any theme.
- A zero-qualified cohort produces zero themes; broad market-post results cannot substitute for qualified profiles.

## Automated checks

`node --test trend-engine.test.mjs content-map-engine.test.mjs` passes sixteen tests covering:

1. LinkedIn relative-date parsing;
2. evidence deduplication;
3. supported cohort qualification;
4. excluded profiles and real date buckets;
5. additive-run set merging;
6. undated evidence;
7. zero-qualified cohort behavior;
8. dominant-contributor share; and
9. the 26-receipt anti-inflation guard;
10. question-to-carousel planning;
11. complaint-to-text planning;
12. Product / Offer frequency control;
13. non-repeating hook formulae;
14. small-sample and concentration blockers; and
15. evidence-backed numeric hooks; and
16. explicit product-launch separation from broader AI and market shifts.

`live-server.mjs`, `trend-engine.mjs`, `content-map-engine.mjs`, and the inline dashboard script pass syntax validation.

## Progressive integration fixture

A local fake MCP fixture containing duplicate posts, an irrelevant profile, missing dates, and repeated results completed a three-profile run through the real localhost API and SSE path.

- Three provisional `trend` events arrived—one after each scored profile.
- The final market-post pass emitted one final, non-provisional aggregate.
- Provisional and final payloads used the same evidence IDs and recomputed from the current set.
- The final cohort was `3 collected / 2 qualified / 1 excluded`.
- The final evidence sample was `6 unique sources / 5 dated / 1 undated`.
- A duplicate market post with a tracking query parameter collapsed into one evidence item.
- All completed person, company, post, fit, trend, draft, and complete events arrived through the existing stream.

## Authenticated live-read check

The real authenticated route completed one fresh serial three-profile read in the headed LinkedIn browser. Person and company cards arrived progressively and the run ended at `3 records ready for review` with six profile/company receipts. None of those broad `VP Sales` search results met the new supported role and company/market requirements. That real edge case exposed a market-search loophole; the engine was then tightened and unit-tested so a zero-qualified cohort now returns zero themes. The default filming query was also restored to `Head of RevOps B2B SaaS` for the next run. The invalid v2 snapshot from this diagnostic run was cleared; the preserved v1 snapshot was not touched.

On 20 September, a fresh `get_my_profile` acceptance read returned a non-empty authenticated profile and the dashboard reached `LinkedIn connected · live read`. The five-profile People Finder search was deliberately not started, leaving the single filming click to the user.

The next authenticated run requested 10 and returned three inspectable profiles. Schema inspection confirmed that `search_people` has no `limit`, `max_pages`, or pagination argument, so the three-profile result was not caused by a dashboard cap. The completion payload now carries requested and candidate counts, and the interface renders `3 of 10 requested profiles returned` with the preserved receipt total.

People Finder now exposes a keyboard-operable `3 / 5 / 10` selector adjacent to the run action. The primary and additive actions include the selected amount. The 13 sourced profile records from the preserved 19 September snapshot load into a separate **Previous runs** panel; their legacy trend aggregates are not loaded into the v2 evidence model. Starting a fresh run archives the current active profiles before clearing its analysis.

## Trend Scanner interface

- Four direct, keyboard-operable views now lead the page: What people discuss, Recent activity, Product launches, and Industry shifts.
- Recent activity sorts dated person posts, company posts, and market-search results chronologically and retains theme matches and source actions.
- Product launches require explicit launch, announcement, release, rollout, availability, or new-product language and are labelled `Observed announcement` rather than buyer intent.
- Industry shifts report breadth and representative evidence while explicitly avoiding a velocity claim from a single window.
- The public example contains 19 clearly labelled illustrative receipts. Live mode uses the identical components with real source URLs and retrieval times from the local connector.
- Frequency bars were replaced by an evidence coverage map.
- Horizontal position represents unique sources.
- Vertical position represents distinct people plus companies.
- Bubble size represents deduplicated mentions.
- Colour represents question, complaint, launch, or company-change signal type.
- Every bubble is a native keyboard-focusable button with an accessible metric label and one selected `aria-pressed` state.
- The selected-theme panel separates Observed, Interpretation, and editable Content angle.
- The evidence stack shows excerpt, subject, source type, date/relative age, retrieval time, and Open source.
- Raw source-ID prose and the quoted “No suitable excerpt” fallback were removed.
- Contributor concentration over 50% produces a visible, text-labelled warning.
- Switching from 30 to 7 days recalculated every view: conversations changed from six themes to four, recent activity from 19 receipts to six, launches from three to two, and industry shifts from two to one.

## Responsive and accessibility checks

A temporary Chrome DevTools audit exercised the completed Trend Scanner at 390 CSS pixels and at 640 CSS pixels with a 2× device scale (the effective 200% zoom case used for this layout).

- No horizontal page overflow or off-screen working elements were found in either case.
- The quality strip collapsed to two columns at 390 px.
- The coverage map and detail panel collapsed to one column.
- All four rendered bubbles remained keyboard-focusable; exactly one exposed selected state.
- Five source links remained available in the selected evidence stack.
- `prefers-reduced-motion: reduce` reduced transition and animation duration to 0.000001 seconds.
- Time-window buttons expose `aria-pressed`; the selected theme exposes `aria-pressed`; status regions remain polite live regions.
- Browser accessibility inspection exposed the Observed, Interpretation, and Content angle headings, the editable textbox, all evidence metadata, and all direct source links.
- Left/Right/Home/End keyboard navigation moves between the four Trend Scanner tabs and updates the selected tab and visible panel together.

## Storage migration

- Evidence-first live state uses `linkedin-signal-analyser-live-v2`.
- A v1-only browser fixture was not loaded into Trend Scanner.
- The interface displayed `Fresh run required for evidence coverage.`
- The v1 key remained present and the v2 key remained absent until a new run started.
- Legacy and completed profile records may be copied to `linkedin-signal-analyser-prior-runs-v1` for the unified lead working set; no v1 theme totals or evidence totals are imported into v2 trend analysis.

## Unified lead workspace and ranking

- The 13 preserved profiles and three current profiles deduplicated to 15 unique LinkedIn leads; the duplicate Dominic Page record resolved to the newer current-run record.
- People Finder rendered all 15 with current/previous run provenance.
- Fit Checker ranked all 15 by fit and timing and split them into seven ICP matches and eight non-matches at the saved fit threshold of 65.
- Evidence Writer exposed all 15 names as selectable draft records.
- Trend Scanner exposed all 15 in Lead coverage while allowing only one evidence-ready qualified lead to influence the current coverage map.

## Twin-tab Evidence Writer

- Outreach drafts and Content map are native keyboard-selectable tabs with one visible panel at a time.
- Content Map rendered six scheduled slots across text, PDF carousel, static image, and short-video formats.
- Each slot exposed topic, pillar, goal, readiness, source count, date, time, and production status.
- A text post and carousel were already available; the static-image generation control was exercised in the browser and changed to `View static` while rendering the generated visual treatment.
- Generated asset state persisted locally and no publishing, file upload, or third-party generation occurred.

## Impeccable detector

The detector was run once after implementation. It found two issues: layout-affecting width/height transitions on map bubbles and a heavy one-sided contributor-warning border. Both were removed. Bubbles now animate position, transform, and opacity only; the warning uses a quiet full border.

## Credibility boundaries

- “Connected” appears only after a non-empty authenticated read.
- Zero-result live searches remain empty and do not import example profiles.
- The workspace stops at editable drafts and never sends, connects, publishes, schedules, reads inboxes, or modifies profiles.
- LinkedIn authentication, CAPTCHA, and security checkpoints remain manual and are never bypassed.
- Small serial read-only batches improve inspectability but do not guarantee account safety or platform permission.

## Content-map planning check

- Every theme now receives a ranked format evaluation across text, carousel, poll, short video, or single image rather than a generic title only.
- The recommendation retains the theme's deduplicated mentions, unique-source count, represented people/companies, and evidence IDs.
- Thin evidence produces `Needs more evidence`; contributor concentration above 50% remains a visible risk.
- Hooks never invent performance or revenue figures and never begin with a question.
- Hook formulae do not repeat inside one generated plan, and Product / Offer is capped at one recommendation.
- The copied map includes pillar, format, goal, hook, post structure, CTA, proof gap, and risk.
- The content-planning vocabulary is attributed in `THIRD-PARTY-NOTICES.md`.

## Five-person recording check

- Setup & Context exposes only the live bridge's accepted batch sizes: 3, 5, and 10.
- Saving a batch of five changes the People Finder action to `Add 5 to run`.
- The client passes the saved size for both fresh and additive runs instead of hard-coded three- or ten-person batches.
- Additive runs preserve the current people and evidence, exclude known usernames, and recompute aggregates rather than summing old counts.
- The shareable setup guide distinguishes fresh and additive actions and documents honest zero-new-result behavior.

## Fresh live acceptance

For final filming, run one fresh authenticated five-profile search in the upgraded workspace and confirm the visible LinkedIn navigation matches the v2 source receipts. This is intentionally required because the old v1 snapshot is preserved but incompatible with evidence-level date and provenance checks.
