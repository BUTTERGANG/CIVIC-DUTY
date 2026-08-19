---
title: "DPW VisionZero Crashes"
status: sprint
priority: P1
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, traffic, safety]
due: null
estimate: medium
---

# DPW VisionZero Crashes

## Summary
Add the Indianapolis DPW VisionZero traffic crash dataset — 249K records with richer safety analytics than the existing IMPD crash feed. Includes pedestrian/bicycle involvement, manner of collision, roadway class, and hit-and-run flags.

## Value Proposition
The existing `crashes` table (IMPD) has basic fields. VisionZero adds:
- **Pedestrian/bicycle counts** — distinguishes vulnerable road user involvement
- **Manner of collision** — head-on, rear-end, sideswipe, angle, etc.
- **Roadway class** — interstate, arterial, collector, local
- **Hit-and-run tracking**
- **Crash type + severity** — more granular classification
- Combined with existing crashes, gives a complete traffic-safety picture

## Context
- Source: `https://gis.indy.gov/server/rest/services/DPW/DPW_VisionZero/FeatureServer/0`
- 26 fields, 249,106 records
- Same `ArcgisScraper` base class
- Has `Latitude`/`Longitude` (point data)
- Distinct from the existing `crashes` scraper (`IMPD/IMPD_Crash_Public`) — these are DPW's analysis feed, not IMPD's operational feed

## Acceptance Criteria
- [ ] New DB table `visionzero_crashes` with relevant fields
- [ ] `src/scrapers/indy_visionzero.ts` — ArcgisScraper config
- [ ] `src/routes/visionzero.ts` — GET /api/visionzero with filters
- [ ] Registered in scheduler — daily at 12pm
- [ ] `CIVIC-DUTY-UI/src/pages/VisionZero.tsx` — card-list with severity badges, pedestrian/bicycle/hit-and-run indicators
- [ ] NavBar link + Dashboard stat card
- [ ] Field mapping tests
- [ ] `run-scraper.ts` entry

## Notes
P1: Medium estimate. Consider whether to merge with existing crashes view or keep separate. The fields overlap with `crashes` but the semantics differ — a combined view in the UI could show both sources with a source badge.