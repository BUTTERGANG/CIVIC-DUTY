---
title: "Zoning Variances (Accela XAPO)"
status: sprint
priority: P2
project: civic-duty
type: dev
agent_claimed: hermes
claimed_at: '2026-08-19T00:00:00Z'
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, zoning, development]
due: null
estimate: small
---

# Zoning Variances (Accela XAPO)

## Summary
Add the Accela XAPO zoning variances layer — 24,698 variance applications with case numbers, recommendations, status, decision dates, and planner assignments. Point geometry with lat/lng.

## Value Proposition
The existing `zoning_changes` table covers public notices and dev projects. Zoning variances are a third category — applications for relief from zoning code requirements. This layer adds:
- Variance case numbers and decisions
- Planner assignments
- Status tracking (approved, denied, pending)
- Point geometry with lat/lng

## Context
- Source: `Accela/ACCELA_XAPO_ADDRESS/MapServer/2`
- 24,698 records, point geometry
- Uses projected coordinate system (State Plane) — ArcgisScraper's `outSR=4326` handles conversion
- Same `ArcgisScraper` base class

## Acceptance Criteria
- [ ] DB table `zoning_variances` with case number, recommendation, status, decision date, planner
- [ ] Scraper in `src/scrapers/indy_zoning_variances.ts`
- [ ] Route `/api/zoning-variances` — search by case number, status, planner, date range
- [ ] Scheduler — weekly, Sun 11am
- [ ] UI page: ZoningVariances.tsx with status badges, case-number search, planner filter
- [ ] NavBar link + Dashboard stat card

## Notes
P2: Small estimate. Complements existing zoning data naturally.