# LinkedIn Signal Analyser: Shareable Setup and Operating Guide

Hosted example: [https://vibha-ramprakash.github.io/Linkedin-Manager/](https://vibha-ramprakash.github.io/Linkedin-Manager/)

For agent-led installation, paste the complete prompt in [`INSTALL-PROMPT.md`](INSTALL-PROMPT.md). The hosted page is intentionally example-only; authentication and live reads stay on the recipient's computer.

This package turns Claude or Codex into a small, human-reviewed LinkedIn research workflow. It can find public profiles, inspect company and post context, qualify an ICP cohort, map recurring themes, and draft evidence-linked outreach and content plans.

It does not provide unlimited LinkedIn access, bypass platform controls, send messages, connect with people, publish posts, or replace human review.

## What the recipient gets

The shareable package contains:

- `signal.html`: the offline example workspace and live-mode client.
- `live-server.mjs`: a localhost-only bridge between the dashboard and LinkedIn MCP.
- `trend-engine.mjs`: evidence normalization, qualification, deduplication, date windows, and trend metrics.
- `content-map-engine.mjs`: format, pillar, goal, hook, readiness, and post-build recommendations.
- `skills/people-finder/SKILL.md`: small-batch sourced discovery.
- `skills/trend-scanner/SKILL.md`: evidence-first trend analysis.
- `skills/fit-checker/SKILL.md`: supported ICP and timing scoring.
- `skills/evidence-writer/SKILL.md`: evidence-linked drafts and content planning.
- `README.md`: concise operator reference.
- `QA-REPORT.md`: verification record and known boundaries.
- `THIRD-PARTY-NOTICES.md`: attribution for adapted planning concepts.

The workspace has two strictly separate modes:

- **Example run** works offline with illustrative records.
- **Live run** uses the recipient's own locally authenticated LinkedIn session.

Example and live records never mix inside one run.

## What is real and what remains conditional

- [Agent Reach](https://github.com/Panniantong/Agent-Reach) routes Claude or Codex to installed research backends. The tested local version for this build was `v1.5.0`.
- [LinkedIn MCP Server](https://github.com/stickerdaniel/linkedin-mcp-server) is an independent, unofficial connector that drives a local browser. Its availability can change when LinkedIn changes its interface.
- A configured connector is not proof of a live connection. This workspace shows `LinkedIn connected · live read` only after a non-empty `get_my_profile` response.
- A successful run depends on the user's authenticated session, permissions, visible public data, account state, and the connector still matching LinkedIn's interface.

LinkedIn's [User Agreement](https://www.linkedin.com/legal/user-agreement) and [Prohibited Software and Extensions policy](https://www.linkedin.com/help/linkedin/answer/a1341387) restrict unauthorized scraping, bots, and automated access. Small, serial, read-only batches improve inspectability but do not guarantee account safety or platform permission. Stop if LinkedIn, the account owner, or organisational policy requires it.

## 1. Install the four skills

Copy the complete folders into the skills directory used by Claude or Codex:

```text
skills/
  people-finder/SKILL.md
  trend-scanner/SKILL.md
  fit-checker/SKILL.md
  evidence-writer/SKILL.md
```

Restart or reload the agent so it discovers them.

The Evidence Writer skill includes the current content-map contract: ranked post formats, pillar, engagement goal, hook pattern, build outline, CTA, evidence breadth, missing proof, and claim risk.

## 2. Install and inspect the LinkedIn research route

Give Claude or Codex this message:

```text
Install Agent Reach from this guide, then set up only the LinkedIn channel:
https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md

Ask before installing system dependencies or enabling automatic updates. When setup is complete, run agent-reach doctor --json. Do not claim LinkedIn works until a read-only tool returns a real, non-empty result.
```

The current Agent Reach installation command is:

```bash
agent-reach install --env=auto --system --channels=linkedin
```

If the LinkedIn channel remains unregistered, add the current upstream stdio connector:

```bash
mcporter config add linkedin --command uvx --arg mcp-server-linkedin@latest --env UV_HTTP_TIMEOUT=300 --scope home
```

Run `agent-reach doctor --json` to inspect configuration. A configured or warning state is not the acceptance test.

## 3. Complete the one-time human login

Authentication must remain human-controlled:

```bash
uvx mcp-server-linkedin@latest --login
```

Finish sign-in, confirmation, CAPTCHA, or any security checkpoint in the visible browser. The workflow never bypasses these steps.

Someone already signed in through a supported local Chromium browser may be able to use the connector's browser-import option. Check the current upstream README because browser requirements can change.

## 4. Prove the session works

Run both smoke tests after authentication:

```bash
mcporter call linkedin.get_my_profile sections="experience"
mcporter call linkedin.search_people keywords="Head of Revenue Operations B2B SaaS" location="London"
```

The setup passes only when both calls return real, non-empty records. If either call fails:

1. Keep the visible browser open.
2. Complete any login or checkpoint.
3. Retry the same harmless read.
4. Stop if the account or platform blocks the activity.

Never replace an empty live response with example profiles or describe it as a successful live search.

## 5. Start the workspace

From the package folder:

```bash
node live-server.mjs
```

Open:

```text
http://127.0.0.1:4317
```

Do not open `signal.html` through `file://` for a live run. The local bridge must serve the page so the event stream and read-only connector can work.

The bridge:

- binds only to `127.0.0.1`;
- keeps credentials, cookies, and session files outside the page;
- launches a visible browser with a 350 ms action delay;
- processes profiles serially;
- streams progressive Server-Sent Events to the dashboard;
- permits only people, profile, company, company-post, market-post, and session-close tools;
- preserves completed records and evidence if a later step fails.

## 6. Save useful business context

Open **Setup & Context**, then enter:

- the exact product or offer;
- the roles that can genuinely own the problem;
- company type and size;
- one region or market for the run;
- the batch size: 3, 5, or 10.

For the current Northstar recording, use:

```text
Product: Northstar is a revenue intelligence workspace that helps B2B SaaS teams turn messy CRM activity into a trusted weekly forecast.
Ideal role: Head of Revenue Operations, Revenue Operations Lead
Market: B2B SaaS · 50–500 employees
Region: UK
Batch size: 5
```

Save the business context before starting. Role points use only the current-role evidence; company/market points use only company evidence; region points use only the normalized location; and problem relevance uses post evidence.

## 7. Run a fresh filming batch

Choose **Live run**. After the connection check succeeds:

1. Open **People Finder**.
2. Use **Next run** beside the action to choose `3`, `5`, or `10`.
3. Click **Run N fresh** once.
4. Do not interact with the LinkedIn window unless login or a checkpoint appears.
5. Watch profiles, company context, fit, trends, and drafts arrive progressively.

The People Finder control and saved Setup batch size stay synchronized. With `10` selected, **Run 10 fresh** requests up to ten profiles. Starting a new live search moves the current profiles into **Previous runs**, clears the active v2 analysis, and then collects the new records.

Ten is a requested maximum, not a guarantee. The current LinkedIn MCP `search_people` tool accepts keywords and location but exposes no pagination or result-limit parameter. If LinkedIn returns only three inspectable top-level profiles, the product reports `3 of 10 requested profiles returned`; it does not invent seven records or silently mix in example data.

## 8. Append exactly five more people

Use this for the next screen recording:

1. Keep the completed live run in the workspace. Do not click **Clear live run**.
2. In **People Finder**, choose `5` under **Next run**. This also updates the saved batch size.
3. Return to **People Finder**.
4. Confirm the secondary action reads **Add 5 to run**.
5. Start recording, place the dashboard beside the visible LinkedIn browser, and click **Add 5 to run** once.

The additive request:

- excludes usernames already present;
- keeps the completed people and evidence;
- requests a maximum of five new profiles;
- recomputes the qualified cohort and trend totals from the merged evidence set;
- never adds old aggregate counts to new counts;
- reports `No new unique profiles found` if LinkedIn returns only duplicates or unusable results.

Five is a strong filming increment because the progressive updates are visible while the batch remains reviewable. It is still not a safety guarantee. If the session looks restricted, a checkpoint appears, or the connector begins failing, stop instead of retrying repeatedly.

## 9. Use search parameters that can qualify

A search result is not automatically a trend participant. Trend qualification requires:

- fit score of at least 65;
- supported current-role match;
- supported company/market match.

Use role phrases that match the actual ICP. For this build, `Head of Revenue Operations` or `Revenue Operations Lead` is more reliable than a broad `VP Sales B2B SaaS` query. A broad search may return visible profiles yet produce zero qualified trend contributors.

If a run returns zero inspectable profiles:

1. Keep the live result empty; do not switch in example data.
2. Shorten the role phrase to one recognizable title.
3. Use a single city or region, such as `London`.
4. Keep market language plain, such as `B2B SaaS`.
5. Retry later rather than rapidly cycling searches.

If a run returns fewer profiles than requested, that is the connector's returned result set rather than a client-side cap. Try one precise title, one city, and plain market wording in a later run; do not loop rapidly to force the number.

## Rank every stored lead

Open **Fit Checker** for the ranked ICP view. The full working set is ordered by fit score, then timing score. Use:

- **All** for the complete ranking;
- **ICP matches** for leads at or above the visible fit threshold;
- **Doesn't match** for leads below it.

Moving the fit threshold recalculates both groups immediately. A high timing score never overrides a weak ICP fit.

## Use Evidence Writer and Content Map

Evidence Writer has two tabs:

1. **Outreach drafts** exposes every deduplicated lead from the last 48 hours. Choose a name to open an editable, source-tagged draft.
2. **Content map** turns the evidence-backed themes into a Monday/Wednesday/Friday schedule. Each slot shows topic, LinkedIn format, pillar, goal, proof readiness, source count, and production status.

The first text post and PDF carousel slide copy are pre-generated. Remaining slots use format-specific actions: **Generate copy**, **Generate carousel**, **Generate static**, or **Generate script**. These controls create local draft assets only; they do not publish, schedule, upload, or call an external image service.

## 10. Understand how Trend Scanner runs

Trend Scanner runs automatically inside the People Finder workflow. There is no separate scrape button.

Use the four views directly beneath the Trend Scanner heading:

1. **What people discuss** for recurring questions, complaints, and themes across the qualified sample.
2. **Recent activity** for the chronological person, company, and market posts scanned in the selected 7/14/30-day window.
3. **Product launches** for explicit launch, release, rollout, and availability announcements. These are observations, not inferred buying intent.
4. **Industry shifts** for broader company and market-search signals. The view reports source breadth but does not claim trend velocity from one snapshot.

Changing the 7/14/30-day control recalculates all four views from dated evidence. Undated receipts remain visible in sample quality but cannot enter a time-window count. In example mode, source actions are labelled as example receipts; in live mode, every supported card links back to the permitted LinkedIn URL returned by the connector.

The **Lead coverage** section always shows the full deduplicated 48-hour working set. `Profile sources only` means the lead remains usable in People Finder, Fit Checker, Evidence Writer, and the source ledger, but does not have normalized dated post evidence for trend aggregation. This keeps previous live leads available without importing unsupported legacy trend totals.

As each qualified profile finishes:

1. its public post and company evidence is normalized;
2. a provisional trend payload updates the coverage map;
3. excluded profiles remain visible but do not influence themes;
4. the final market-post pass reconciles the aggregate.

The map uses:

- horizontal position: unique sources;
- vertical position: distinct people and companies;
- bubble size: deduplicated mentions;
- colour: question, complaint, launch, or company-change signal type.

The 7, 14, and 30-day controls recalculate from publication dates or usable relative dates. Undated evidence stays visible in sample quality but is excluded from time-window totals. Contributor share above 50% creates a concentration warning.

Every evidence card retains its source URL, excerpt or paraphrase, source type, publication or relative date when available, and retrieval time.

## 11. Understand Fit Checker and Evidence Writer

Fit Checker keeps fit and timing separate. A job change, promotion, or launch can affect timing but cannot manufacture ICP fit.

Evidence Writer stops at editable drafts. Outreach personalization carries source references in the review version. The Content Map now evaluates each theme across text post, carousel, poll, short video, and single image, then provides:

- recommended format and ranked alternatives;
- Authority, Personal Narrative, Community, or Product / Offer pillar;
- comments, reposts, likes, or saves goal;
- non-repeating hook formula and draft hook;
- post structure and CTA;
- unique-source and contributor coverage;
- required firsthand proof;
- readiness blockers and claim risk.

Thin or concentrated evidence is downgraded instead of presented as a ready market insight. The planning vocabulary is adapted from [sergebulaev/linkedin-skills](https://github.com/sergebulaev/linkedin-skills) under the MIT license; see `THIRD-PARTY-NOTICES.md`.

## 12. Recording choreography

Before recording:

1. Complete login and both smoke tests.
2. Start `node live-server.mjs`.
3. Choose **Live run** and confirm `LinkedIn connected · live read`.
4. Place the dashboard on the left and visible LinkedIn browser on the right.
5. Enable **Recording privacy** to mask dashboard surnames.
6. Blur real names and profile photos on the LinkedIn half during the final edit.

During the take:

1. Click **Run live search** for a new five-person run, or **Add 5 to run** for the additive take.
2. Let the visible browser navigate without further input.
3. Show People Finder cards arriving.
4. Move to Trend Scanner after evidence begins appearing.
5. Show the qualified count, coverage bubbles, and one source card.
6. Open Fit Checker to show supported fit separately from timing.
7. Open Evidence Writer and expand **Build this post** to show the format decision, hook, proof requirement, and risk.
8. End on Review Queue to make the human approval boundary explicit.

## 13. Failure behavior

- **Expired login or checkpoint:** the run pauses, completed evidence remains, and the dashboard shows `LinkedIn connection needs attention`.
- **Zero results:** live mode remains empty and does not fall back to example data.
- **Duplicate additive results:** the run may honestly add zero new unique profiles.
- **Interrupted event stream:** completed evidence is preserved; do not assume unseen steps finished.
- **Missing post dates:** evidence is labelled undated and excluded from the 7/14/30-day totals.
- **Zero qualified profiles:** Trend Scanner shows no themes even if a broad market search contains matching words.
- **Connector interface breakage:** update or repair the independent connector; do not weaken the evidence rules to make the dashboard look populated.

## 14. Data storage and reset behavior

- Example-mode edits and review decisions use browser local storage.
- Evidence-first live state uses `linkedin-signal-analyser-live-v2`.
- The old v1 snapshot remains untouched and is never loaded into the new Trend Scanner.
- **Clear live run** removes the current v2 live snapshot from the workspace.
- Starting a fresh live search clears the current v2 run.
- **Add to run** merges new permitted evidence into the current v2 run.

No LinkedIn credentials are written into this package.

## 15. Read-only boundaries

The live bridge allows only:

```text
search_people
get_person_profile
get_company_profile
get_company_posts
search_posts
close_session
```

It does not expose sending, connecting, inbox actions, publishing, scheduling, or profile modification. The workflow ends at drafts and the Review Queue.

## 16. Verification before sharing

Before sending the package to someone else:

```bash
node --test trend-engine.test.mjs content-map-engine.test.mjs
node --check live-server.mjs
node --check trend-engine.mjs
node --check content-map-engine.mjs
```

Then confirm manually:

- Example run opens without LinkedIn.
- Live run does not claim connection before a non-empty profile read.
- The batch control exposes only 3, 5, and 10.
- Saving 5 makes a fresh search request five profiles and changes the additive action to **Add 5 to run**.
- An additive run excludes existing usernames.
- Every evidence card has a permitted URL and retrieval time.
- Excluded profiles do not influence themes.
- Content recommendations show evidence breadth, proof gaps, and risks.
- Keyboard navigation, 200% zoom, reduced motion, and the 390 px layout remain usable.

## Copy-paste operating prompt

```text
Help me set up a read-only LinkedIn research workspace. First inspect Agent Reach and identify the LinkedIn route that is actually available. Do not claim it works until get_my_profile and one people search return non-empty results. Never send messages, connect, publish, schedule, read inboxes, or modify profiles.

Use the People Finder, Trend Scanner, Fit Checker, and Evidence Writer skills in that order. My product is [PRODUCT]. My ICP roles are [ROLES]. My company market and size are [MARKET]. My region is [REGION]. Start with five profiles. Preserve source URLs, retrieval times, supported fields, and unknowns. Qualify the cohort before calculating trends. Stop at editable outreach and content drafts for human review.
```

Use **Example run** when authentication is unavailable. Use **Live run** only with a permitted session and data.
