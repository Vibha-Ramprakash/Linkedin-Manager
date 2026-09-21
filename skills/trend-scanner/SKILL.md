---
name: linkedin-trend-scanner
description: Analyse a small approved LinkedIn people or company batch for repeated questions, complaints, launches, and industry changes over a defined time window. Use after People Finder or with user-supplied LinkedIn posts. Produces sampled signals, not market-wide sentiment.
---

# LinkedIn Trend Scanner

Turn a bounded evidence set into traceable themes.

## Required inputs

- An approved `people.json`, company list, or user-supplied post set
- A time window, default 30 days and maximum 90 days
- The business offer and research question
- A workspace directory

## Preferred tools

Use Agent Reach to verify the LinkedIn route. When available, use read-only tools such as:

- `search_posts`
- `get_company_posts`
- `get_person_profile`
- `get_company_profile`

Use the smallest query set that answers the research question. If post access is unavailable, analyse only user-supplied text or clearly permitted sources and label that limitation.

## Workflow

1. Record the collected sample, time window, and collection date.
2. Qualify the cohort before trend analysis. Require fit ≥65 plus supported current-role and company/market matches. Profile text cannot substitute for company evidence.
3. Gather recent public posts or activity relevant to the stated research question.
4. Normalize every inspected item with an ID, source ID, person/company IDs, source type, URL, excerpt, published or relative date when available, retrieval time, and matched terms.
5. Deduplicate by canonical URL, source type, and normalized excerpt. Additive runs merge evidence sets and recompute; never add previous aggregate counts.
6. Exclude undated evidence from 7/14/30-day totals while keeping it visible as `undated` in sample quality.
7. Code each item into one or more signal types: `question`, `complaint`, `launch`, `company-change`, or `market-change`. Apply `launch` only when the source text contains explicit launch, announcement, release, rollout, availability, or new-product language.
8. Group similar items into themes and count each evidence item no more than once per theme.
9. Separate exact observation metrics from cautious interpretation and the editable content angle.
10. Save `trends.json` and `trend-brief.md`.

## Output contract

```json
{
  "provisional": false,
  "periodDays": 30,
  "cohort": {
    "collected": 8,
    "qualified": 4,
    "excluded": 4,
    "exclusionReasons": []
  },
  "themes": [
    {
      "id": "forecast",
      "label": "Forecast trust",
      "type": "question",
      "metrics": {
        "mentions": 4,
        "uniqueSources": 4,
        "distinctPeople": 3,
        "distinctCompanies": 2
      },
      "periods": { "7": {}, "14": {}, "30": {} },
      "evidenceIds": ["EV-01", "EV-07"],
      "topContributorShare": 0.5,
      "interpretation": "A cautious explanation, not a fact",
      "contentAngle": "An editable idea subordinate to the observation"
    }
  ],
  "evidence": []
}
```

## Safety and quality rules

- Do not call a small sample a universal trend.
- Do not fabricate quotations or dates. Prefer short paraphrases.
- Do not infer private intent, emotion, health, politics, ethnicity, religion, or other sensitive traits.
- Respect platform terms and access controls. Do not bypass limits.
- Treat promotions and job changes as context signals, not evidence that somebody wants to buy.
- Never let an excluded profile influence a theme.
- If no profiles qualify, return no themes. A broad market-post search can enrich a qualified cohort but cannot replace one.
- Warn when one person or company supplies more than half of a theme.
- Every evidence card must resolve to its source URL and show retrieval time.
- Present the result through four inspectable views: recurring conversations, chronological recent activity, explicit product launches, and broader industry/company shifts.
- Label launches as observed announcements. Do not infer adoption, demand, or purchase intent from an announcement.
- Label industry shifts as current-window signals. Do not claim direction or velocity without a comparable earlier window.

## Completion check

Every theme must show mentions, unique sources, represented people and companies, time-window metrics, contributor concentration, and evidence IDs. A human reviewer must be able to open each source. The count labelled as unique evidence must be the size of the deduplicated evidence set—not a sum of overlapping theme totals.
