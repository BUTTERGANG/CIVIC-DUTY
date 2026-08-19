---
title: "Indianapolis Historic Sites (Accela AGIS)"
status: sprint
priority: P2
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, heritage, parcels]
due: null
estimate: small
---

# Indianapolis Historic Sites (Accela AGIS)

## Summary
Add the Accela AGIS historic sites layer — 2,103 Indianapolis historic properties with year built, address, district, rating, SHAARD ID, and notes.

## Value Proposition
When researching a parcel (existing `parcels` page), knowing whether a property is a designated historic site and what year it was built is high-value context. This layer provides civic heritage data alongside the existing assessment data — helpful for home buyers, researchers, and neighborhood associations.

## Context
- Source: `https://gis.indy.gov/server/rest/services/Accela/AGIS_INDIANAPOLIS/MapServer/4`
- Small dataset (2,103 records), weekly refresh
- ArcgisScraper base class
- Has `SHAPE` geometry (point)

## Acceptance Criteria
- [ ] New DB table `historic_sites`
- [ ] `src/scrapers/indy_sites.ts`
- [ ] `src/routes/historic_sites.ts`
- [ ] Scheduler — weekly, Sun 6am
- [ ] UI page: card-list with search (address, district, rating), year-built highlight
- [ ] NavBar link + Dashboard stat card
- [ ] Basic tests

## Notes
P2: Small estimate. Clean win alongside the parcel data — could eventually show a historic-site badge on the Parcels page itself.