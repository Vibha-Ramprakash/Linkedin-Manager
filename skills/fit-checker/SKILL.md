---
name: linkedin-fit-checker
description: Score an evidence-linked LinkedIn shortlist against an explicit ICP and keep fit separate from timing. Use when the user wants to prioritise a small prospect or expert list. Does not claim buying intent and does not contact anyone.
---

# LinkedIn Fit Checker

Prioritise transparently. Never turn guesses into intent claims.

## Required inputs

- `people.json` from People Finder or an equivalent user-approved list
- The offer and written ICP criteria
- Optional `trends.json`
- User-approved weights, or the defaults below

## Default score model

Fit score, 0 to 100:

- Role and seniority match: 30
- Company type and size match: 25
- Market and region match: 20
- Relevant responsibility or problem evidence: 25

Timing score, 0 to 100, kept separate:

- Recent public job change: 25
- Recent promotion: 20
- Relevant company launch or initiative: 30
- Recent evidence-backed discussion of the problem: 25

Missing evidence receives zero for that criterion and is listed as unknown. Do not fill gaps with inference.

## Workflow

1. Show the rubric and weights before scoring.
2. Score only sourced facts.
3. Add a reason and source ID for every awarded point group.
4. Record unknowns and contradictory evidence.
5. Apply the visible fit threshold:
   - At or above threshold with supported role and company/market matches: `auto-approved-for-drafting`
   - Below threshold: `outside-icp-review`
6. Extract major public changes separately as structured timing signals: new role, promotion, company move, company expansion, or product launch.
7. Use timing only to order people inside a fit class. High timing never rescues poor fit.
8. Save `fit.json` and `fit-review.md`.

## Output contract

```json
{
  "person_id": "stable-local-id",
  "fit_score": 82,
  "timing_score": 45,
  "classification": "auto-approved-for-drafting",
  "fit_reasons": [
    {"criterion": "role", "points": 30, "source_ids": ["src-01"]}
  ],
  "timing_signals": [
    {"type": "Role change", "detail": "Promoted to VP Revenue Operations", "points": 20, "source_ids": ["src-03"]}
  ],
  "unknowns": ["budget ownership"],
  "human_decision": "auto-approved-for-drafting"
}
```

## Safety and quality rules

- Fit means match to declared criteria, not personal worth or purchase intent.
- Timing signals are conversation context, not proof of urgency. Show their type, detail, and source IDs separately from fit.
- Never score sensitive personal attributes.
- Never hide weights or create false precision. Scores are triage aids.
- ICP matches may be auto-approved for drafting. Outside-ICP exceptions require human approval before reaching Evidence Writer.
- Auto-approval never authorizes sending. Every draft remains editable and requires human review before external use.

## Completion check

Each score must be reproducible from the visible rubric and linked sources. The output must preserve rejected and unknown records so the user can audit the decision.
