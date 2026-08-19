---
title: "Licensed Daycare Facilities + Places of Worship"
status: sprint
priority: P2
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, community, family]
due: null
estimate: small
---

# Licensed Daycare Facilities + Places of Worship

## Summary
Add two community directory layers from the Accela AGIS system: licensed daycare ministries (~195) and places of worship (~1,072).

## Value Proposition
Family-focused civic data. Daycare search is one of the most common neighborhood queries — "what licensed daycares are near me?" Places of worship are a community anchor layer. Both are small, static datasets that fill a community-resource gap.

## Context
- Sources:
  - Daycare Ministries: `Accela/AGIS_INDIANAPOLIS/MapServer/3`
  - Places of Worship: `Accela/AGIS_INDIANAPOLIS/MapServer/0`
- Both are very small datasets, trivial scrape
- Weekly refresh is sufficient
- Could be one scraper file (`src/scrapers/indy_community.ts`) that handles both layers

## Acceptance Criteria
- [ ] DB tables: `daycares` + `places_of_worship`
- [ ] `src/scrapers/indy_community.ts` — scrapes both layers
- [ ] Routes: `/api/daycares`, `/api/places-of-worship`
- [ ] Scheduler — weekly, Thu 6am
- [ ] UI pages: simple directory cards with search by name/address
- [ ] NavBar links + Dashboard stat cards

## Notes
P2: Small estimate — two tables in one scraper. Combined into one backlog item since they share a source (Accela AGIS) and a scraper module.