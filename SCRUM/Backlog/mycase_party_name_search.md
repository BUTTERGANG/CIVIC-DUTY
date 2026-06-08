---
title: "MyCase Party-Name Search"
status: sprint
priority: P3
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: medium
---

# MyCase Party-Name Search

## Summary
Extend the MyCase court lookup from exact case-number only to also support searching by party name (plaintiff or defendant), making the Court feature usable for general case discovery.

## Value Proposition
Documented in `TODO.md`. The current `src/scrapers/court.ts` requires an exact case number — a high barrier that limits the feature to users who already know what they're looking for. Party-name search transforms it into an actual research tool: look up whether a contractor, developer, or public figure has active litigation in Hamilton County courts.

## Context
- Documented: `TODO.md` — "MyCase party-name search"
- Existing: `src/scrapers/court.ts` — Playwright + MyCase, on-demand only
- MyCase API endpoint: `POST /mycase/Search/SearchCases` with body `{ Mode: "ByParty", ... }`
- Returns multiple case matches; need to handle pagination
- Frontend: `CIVIC-DUTY-UI/src/pages/Court.tsx` — add party-name search input alongside existing case number input

## Acceptance Criteria
- [ ] `POST /api/court/lookup` accepts `{ partyName: string }` in addition to `{ caseNumber: string }`
- [ ] Playwright handler calls MyCase `/mycase/Search/SearchCases` with `Mode: "ByParty"`
- [ ] Results return up to 20 matching cases with case number, type, status, parties, and next hearing
- [ ] Results paginated if >20 matches; frontend shows "Load more" button
- [ ] Frontend Court page adds a "Search by name" input tab alongside "Lookup by case number"

## Notes
P3: Medium estimate. Main uncertainty is MyCase's exact ByParty request/response format — inspect with Playwright first. CAPTCHA still applies; on-demand only, no cron.
