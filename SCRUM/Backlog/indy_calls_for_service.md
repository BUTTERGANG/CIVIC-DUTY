---
title: "IMPD Calls for Service (CFS_Public)"
status: sprint
priority: P1
project: civic-duty
type: dev
agent_claimed: hermes
claimed_at: '2026-08-19T00:00:00Z'
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, police, public-safety]
due: null
estimate: large
---

# IMPD Calls for Service (CFS_Public)

## Summary
Add the IMPD Computer Aided Dispatch (CAD) Calls for Service dataset — every police dispatch call received by Indianapolis public safety communications. This is the richest single public-safety dataset available: **5.1M records** with lat/lng, response timelines, and council district geography.

## Value Proposition
The existing `incidents` table (IMPD NIBRS) has no lat/lng and limited fields. CFS data adds:
- **Geographic filtering** — lat/lng, council district, police beat, zip code
- **Response-time analysis** — received → dispatched → arrived → completed timeline
- **Call source** — whether citizen-initiated, officer-initiated, or automated
- **Dispatch detail** — primary dispatch code, incident type classification

Together, these enable the most requested civic feature: "what's happening in my neighborhood" with actual street-level data.

## Context
- Source: `https://gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/FeatureServer/0`
- 28 fields, 5,138,709 records (as of 2026-08-19)
- Same `ArcgisScraper` base class as existing Indy scrapers — pagination, retries, field mapping, upsert all handled
- First run will be long (~15-30 min); subsequent runs incremental
- Non-spatial? No — has `Latitude` and `Longitude` fields (point data)
- OrderByFields: `RecDateTime DESC` for incremental scraping

## Acceptance Criteria
- [ ] New DB table `calls_for_service` with schema matching CFS fields
- [ ] `src/scrapers/indy_cfs.ts` — ArcgisScraper config mapping CFS fields to DB columns
- [ ] `src/routes/cfs.ts` — GET /api/cfs (filters: city, incident_type, district, from, to, limit, offset) + GET /api/cfs/:id
- [ ] Registered in `src/scheduler.ts` — daily at 11am
- [ ] `CIVIC-DUTY-UI/src/pages/CallsForService.tsx` — card-list page with type/district/date filters, expanded detail
- [ ] NavBar link + Dashboard stat card
- [ ] Tests for field mapping in `src/__tests__/arcgis.test.ts`
- [ ] `run-scraper.ts` entry for manual invocation

## Schema sketch
```sql
CREATE TABLE IF NOT EXISTS calls_for_service (
    id SERIAL PRIMARY KEY,
    city TEXT NOT NULL DEFAULT 'indy',
    cad TEXT,                           -- CAD incident number
    call_source TEXT,                   -- Citizen, Officer, Auto
    incident_type TEXT NOT NULL,
    primary_dispatch TEXT,
    address TEXT,
    received_at TIMESTAMP WITH TIME ZONE,
    dispatched_at TIMESTAMP WITH TIME ZONE,
    arrived_at TIMESTAMP WITH TIME ZONE,
    cleared_at TIMESTAMP WITH TIME ZONE,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    district TEXT,
    council_district TEXT,
    source TEXT DEFAULT 'indy_cfs',
    scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(city, cad)
);
```

## Notes
P1: Large estimate due to volume. Consider whether to use `RecDateTime > last_run` where clause for incremental runs. The first full sync is a one-time cost.