# LinkedIn Signal Analyser

**Public example:** [vibha-ramprakash.github.io/Linkedin-Manager](https://vibha-ramprakash.github.io/Linkedin-Manager/)

The hosted page is an example workspace only. Live LinkedIn research is deliberately local: clone the repository, follow [SETUP-GUIDE.md](SETUP-GUIDE.md), or paste [INSTALL-PROMPT.md](INSTALL-PROMPT.md) into a local coding agent.

A filmable research workspace with two explicitly separate modes:

- **Example run** works offline with locally stored example records.
- **Live run** uses the locally authenticated Agent Reach LinkedIn route and a visible, read-only browser session.

Live mode does not grant unlimited access, bypass platform controls, connect with people, or send messages.

## Open the example workspace

Open `signal.html` in a modern browser. No server or LinkedIn account is required. The top bar remains labelled `Example data · no live LinkedIn session`.

## Start the live workspace

First complete the one-time LinkedIn sign-in:

```bash
uvx mcp-server-linkedin@latest --login
```

Then start the local bridge from this folder:

```bash
node live-server.mjs
```

Open:

```text
http://127.0.0.1:4317
```

Choose `Live run`. The workspace performs a harmless profile read before showing `LinkedIn connected · live read`. A configured MCP alone is not treated as proof of a working session.

## Side-by-side recording

1. Complete login before the take.
2. Start `live-server.mjs`.
3. Choose `Live run` so the visible MCP browser opens.
4. Place Signal Analyser on the left and the MCP browser on the right.
5. Enable `Recording privacy` if the dashboard identities should be masked.
6. Start screen capture and click `Run live research` once.

The browser visibly navigates LinkedIn with a 350 ms action delay. The dashboard receives progressive events as profiles, companies, posts, fit scores, themes, and drafts become available. No additional click is required unless LinkedIn presents a login confirmation, CAPTCHA, or security checkpoint.

Blur real names and profile photos in the LinkedIn half before publishing the recording.

For the next take, choose `3`, `5`, or `10` from the **Next run** control beside the People Finder action. **Run 10 fresh** requests up to ten people. When a live run already contains records, **Add 10 to run** retains the current evidence, excludes usernames already present, and recomputes the qualified cohort and trends from the merged evidence set.

The requested amount is a maximum, not a guaranteed result count. The installed LinkedIn people-search tool does not expose pagination or a result-limit parameter, so LinkedIn may return fewer inspectable profiles for a query. The completion state reports the returned count against the requested count instead of presenting under-delivery as a dashboard error.

## Live-run boundaries

- The saved batch size controls both fresh and additive runs and can request 3, 5, or 10 profiles.
- Profiles are processed serially.
- Tools are restricted to people search, person profiles, company profiles/posts, post search, and session closure.
- The server binds only to `127.0.0.1`.
- Browser cookies and session data are never sent to the page.
- Sending, connecting, inbox access, and publishing are not available.
- If a live search returns zero results, the interface stays empty. Example records are never mixed into a live run.
- `Run live search` starts fresh; `Add N to run` preserves and deduplicates the existing v2 run.
- Earlier sourced profiles are retained in the unified 48-hour working set with `Previous run` provenance. They remain usable in People Finder, Fit Checker, Evidence Writer, and Review Queue, but do not enter Trend Scanner aggregates without normalized evidence.

## Workspace views

| Reel beat | Product view |
| --- | --- |
| Research team and outputs | Research Overview |
| Agent Reach, MCP, and context | Setup & Context |
| Small sourced batch | People Finder |
| Recent activity and themes | Trend Scanner |
| ICP and timing checks | Fit Checker |
| Drafts and content ideas | Evidence Writer |
| Human approval | Review Queue |

## Unified 48-hour lead workspace

Live mode deduplicates the current v2 run and the preserved 19 September profile receipts into one 15-lead working set. People Finder shows all 15 with `Current run` or `Previous run` provenance. Fit Checker ranks the same set by fit score, then timing, and exposes `All`, `ICP matches`, and `Doesn't match` filters. Evidence Writer exposes all 15 as selectable draft tabs, and Review Queue resolves their retained source receipts.

Trend Scanner lists all 15 under **Lead coverage**, but only profiles with normalized post evidence can influence the evidence map. A legacy profile with profile/company receipts remains visible as `Profile sources only`; it is not treated as dated trend evidence.

## Package contents

- `signal.html`: offline workspace plus the live-mode client
- `index.html`: GitHub Pages entry point for the hosted example
- `INSTALL-PROMPT.md`: copy-paste Agent Reach and LinkedIn setup prompt
- `live-server.mjs`: localhost-only LinkedIn bridge and event stream
- `trend-engine.mjs`: evidence normalization, cohort qualification, date bucketing, deduplication, and theme metrics
- `trend-engine.test.mjs`: deterministic evidence and additive-run fixtures
- `content-map-engine.mjs`: evidence-aware pillar, format, goal, hook, readiness, and post-build recommendations
- `content-map-engine.test.mjs`: deterministic content-planning and claim-safety checks
- `config/mcporter.json`: visible, slowed, keep-alive LinkedIn MCP configuration
- `SETUP-GUIDE.md`: install, authentication, and implementation guide
- `THIRD-PARTY-NOTICES.md`: attribution for adapted content-planning concepts
- `QA-REPORT.md`: functional, credibility, and accessibility checks
- `skills/people-finder/SKILL.md`
- `skills/trend-scanner/SKILL.md`
- `skills/fit-checker/SKILL.md`
- `skills/evidence-writer/SKILL.md`

## Data handling

Example-mode edits and review decisions are stored in browser local storage. Evidence-first live results use the `linkedin-signal-analyser-live-v2` key. Previous profile records are copied into `linkedin-signal-analyser-prior-runs-v1` for the separate reference panel; legacy trend aggregates are never imported into Trend Scanner. Source receipts include the permitted URL and retrieval time returned by the connector. No LinkedIn credentials are written into this package.

## Evidence-first Trend Scanner

Trend Scanner uses only profiles that meet the supported role, company/market, and fit requirements. A market-post search may enrich that qualified cohort but cannot replace one; zero qualified profiles produce zero themes. It deduplicates source receipts, excludes undated items from 7/14/30-day totals, and recomputes appended runs from the merged evidence set instead of adding old totals.

Four keyboard-operable views make the research easier to inspect:

- **What people discuss** maps recurring questions, complaints, launches, and changes by source breadth.
- **Recent activity** shows the dated person posts, company posts, and market-search receipts in chronological order.
- **Product launches** shows only posts with explicit launch, release, rollout, or availability language and labels them as observed announcements—not purchase intent.
- **Industry shifts** groups wider market and company-change signals while stating that a current-window sample is not a velocity claim.

The coverage map uses unique sources horizontally, represented people and companies vertically, and deduplicated mentions for bubble size. Selecting a bubble exposes observation metrics, a cautious interpretation, an editable content angle, and direct source links. The hosted example includes clearly labelled illustrative receipts; live mode uses the same views with LinkedIn source URLs and retrieval times returned by the local connector.

## Evidence-led Content Map

Evidence Writer turns each sourced theme into a usable post plan. It ranks text, carousel, poll, short-video, and single-image fit; assigns a pillar and engagement goal; proposes a non-repeating hook pattern; and shows the post structure, CTA, missing proof, sample risk, and evidence coverage. A concentrated or single-source signal is visibly downgraded instead of presented as a ready market insight.

The planning vocabulary and hook-pattern discipline are adapted from [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills). This package does not execute that repository or send content to LinkedIn; see `THIRD-PARTY-NOTICES.md`.

Evidence Writer now has two product tabs: **Outreach drafts** and **Content map**. Content Map builds a six-slot Monday/Wednesday/Friday schedule with topic, format, pillar, goal, readiness, source count, and production state. Text posts, PDF carousel slide copy, static-image treatments, and short-video scripts use format-specific generation actions. Generated states and the selected asset persist locally; every output remains a draft requiring human review.
