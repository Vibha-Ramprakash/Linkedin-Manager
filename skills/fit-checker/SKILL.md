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
5. Classify:
   - `priority-review`: fit 75 or above
   - `possible`: fit 55 to 74
   - `not-now`: fit below 55
6. Use timing only to order people inside a fit class. High timing never rescues poor fit.
7. Save `fit.json` and `fit-review.md`.

## Output contract

```json
{
  "person_id": "stable-local-id",
  "fit_score": 82,
  "timing_score": 45,
  "classification": "priority-review",
  "fit_reasons": [
    {"criterion": "role", "points": 30, "source_ids": ["src-01"]}
  ],
  "timing_signals": [
    {"signal": "promotion", "points": 20, "source_ids": ["src-03"]}
  ],
  "unknowns": ["budget ownership"],
  "human_decision": "pending"
}
```

## Safety and quality rules

- Fit means match to declared criteria, not personal worth or purchase intent.
- Timing signals are conversation context, not proof of urgency.
- Never score sensitive personal attributes.
- Never hide weights or create false precision. Scores are triage aids.
- Require human approval before a record reaches Evidence Writer.

## Completion check

Each score must be reproducible from the visible rubric and linked sources. The output must preserve rejected and unknown records so the user can audit the decision.
