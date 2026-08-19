---
title: "Parcel Ownership + Property Assessments (Accela HHC)"
status: sprint
priority: P1
project: civic-duty
type: dev
agent_claimed: hermes
claimed_at: '2026-08-19T00:00:00Z'
created: '2026-08-19T00:00:00Z'
updated: '2026-08-19T00:00:00Z'
tags: [arcgis, indy, parcels, property, ownership]
due: null
estimate: medium
---

# Parcel Ownership + Property Assessments (Accela HHC)

## Summary
Add two Accela HHC (Health & Hospital Corporation) layers from gis.indy.gov: parcel ownership records (410K) and property assessment values (354K). Together they let users search Indianapolis properties by owner name, view assessed land/improvement values, and see property classification.

## Value Proposition
The existing `parcels` table has basic assessment data but no owner-name search. These two layers fill that gap:
- **ParcelOwner** (410K records): FULLOWNERNAME, PROPERTY_CLASS, TOWNSHIPNAME, OWNERADDRESS, ASSESSORYEAR_LANDTOTAL, ASSESSORYEAR_IMPTOTAL
- **ACCELA_XAPO_PARCEL** (354K records): IMPROVED_VALUE, LAND_VALUE, LEGAL_DESC, PARCEL_NUMBER, STATE_PINP, OWNER_NAME

Together they enable the most-requested property feature: "who owns this property?" and "what's it worth?"

## Context
- Source: `Accela/HHC_ParcelOwner/MapServer/1` (410K, non-spatial table)
- Source: `Accela/ACCELA_XAPO_ADDRESS/MapServer/0` (354K, has SHAPE geometry)
- Same `ArcgisScraper` base class
- Weekly refresh (low churn)
- ParcelOwner is non-spatial (no geometry); XAPO_PARCEL has SHAPE geometry

## Acceptance Criteria
- [ ] DB table `parcel_owners` with owner name, property class, township, owner address, assessed values
- [ ] DB table `property_assessments` with improved value, land value, legal description, parcel number
- [ ] Scraper `src/scrapers/indy_parcel_owners.ts` — two ArcgisScraper instances
- [ ] Route `/api/parcel-owners` — search by owner name, parcel number, address, property class
- [ ] Route `/api/property-assessments` — search by parcel number, address
- [ ] Scheduler — weekly, Sun 10am
- [ ] UI pages: ParcelOwners.tsx (search by owner name) + PropertyAssessments.tsx (view by parcel)
- [ ] NavBar links + Dashboard stat cards
- [ ] Tests for field mapping

## Notes
P1: Medium estimate. Two tables in one scraper module. The ParcelOwner data is the higher-value of the two — searching by owner name is the #1 gap in the current parcel tool.