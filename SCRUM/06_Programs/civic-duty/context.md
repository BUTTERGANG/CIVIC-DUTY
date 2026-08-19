# CivicDuty — Data Source Expansion Plan

> **Last Updated:** 2026-08-19
> **Status:** Active
> **Source:** Discovery scan of `gis.indy.gov` ArcGIS catalog and Indiana public data portals

---

## Overview

CivicDuty currently covers three regions (Fishers, Indianapolis, Hamilton County) across ~17 tables. A systematic scan of the Indy ArcGIS service catalog (`gis.indy.gov/server/rest/services`) identified **dozens of additional publicly-accessible layers** that fill meaningful civic data gaps.

This document catalogues them by effort tier and tracks build progress.

---

## Foundational Pattern

Every new ArcGIS dataset follows the same build path:

1. **DB migration** — add table via `ALTER TABLE ... IF NOT EXISTS` in `src/db/schema.sql`
2. **Scraper** — new file in `src/scrapers/` using the `ArcgisScraper` base class from `src/scrapers/arcgis.ts`
3. **Route** — new file in `src/routes/` with GET list + GET /:id
4. **Cron** — register in `src/scheduler.ts` (weekly for low-churn data, daily for active data)
5. **UI page** — new lazy-loaded page in `CIVIC-DUTY-UI/src/pages/`
6. **App wiring** — route in App.tsx, NavLink in Shared.tsx, stat meta in Dashboard.tsx
7. **Tests** — ArcGIS mapping tests in `src/__tests__/arcgis.test.ts`

The `ArcgisScraper` base class handles pagination, retries, rate limiting, field mapping, ring-centroid fallback, epoch date conversion, and upsert already — typical new dataset is ~50 lines of config.

---

## Tier 1 — High Impact, ArcGIS (Infrastructure Exists)

All available at `https://gis.indy.gov/server/rest/services/<path>` — same source, same scraper class.

### 1. IMPD Calls for Service (CFS_Public)

| Property | Value |
|----------|-------|
| Source | `IMPD/IMPD_Public_Data/FeatureServer/0` |
| Records | **5,138,709** |
| Key fields | IncidentType, sAddress, Latitude, Longitude, RecDateTime, DspDateTime, ArrDateTime, CmplDateTime, CallSource, Geo_Council, Geo_District |
| Why | Every 911/police dispatch with response-time analysis. Richer than existing NIBRS incidents (which have no lat/lng). Geo-fields enable council-district-level filtering. |
| Volume | Large. First run ~15-30 min. Subsequent runs incremental by date. |
| Schedule | Daily (active data) |
| Status | **Ready to build** |

### 2. DPW VisionZero Crashes

| Property | Value |
|----------|-------|
| Source | `DPW/DPW_VisionZero/FeatureServer/0` |
| Records | **249,106** |
| Key fields | Vehicles, PeopleInvolved, Pedestrians, Bicycle, Injuries, Fatalities, HitandRun, RoadwayClass, MannerofCollision, CrashType, Severity, Latitude, Longitude, CrashDate, Geo_Council |
| Why | Complements existing IMPD crash data with traffic-safety-specific fields (pedestrian/bicycle involvement, roadway class, manner of collision). DPW VisionZero is the city's traffic safety program — distinct from the IMPD crash reporting feed. |
| Volume | Moderate. |
| Schedule | Daily |
| Status | **Ready to build** |

### 3. Historic Sites (Accela AGIS)

| Property | Value |
|----------|-------|
| Source | `Accela/AGIS_INDIANAPOLIS/MapServer/4` |
| Records | **2,103** |
| Key fields | ITEM, ADDRESS, YEAR_BUILT, DISTRICT, RATING, NOTES, SHAARD_ID |
| Why | Civic heritage layer — historic properties with year built, address, district, rating. Useful for property research alongside parcels. |
| Volume | Small. |
| Schedule | Weekly (low churn) |
| Status | **Ready to build** |

### 4. Licensed Daycare Facilities

| Property | Value |
|----------|-------|
| Source | `Accela/AGIS_INDIANAPOLIS/MapServer/3` (Daycare Ministries) |
| Records | **195** |
| Key fields | FACILITY_NAME, LOCATION_ADDRESS, LICENSE_NUMBER, PROVIDERTYPE |
| Why | Parent-facing utility — find licensed daycares near an address. Relevant to the Fishers/Indy family audience. |
| Volume | Trivial. |
| Schedule | Weekly |
| Status | **Ready to build** |

### 5. Places of Worship

| Property | Value |
|----------|-------|
| Source | `Accela/AGIS_INDIANAPOLIS/MapServer/0` |
| Records | **1,072** |
| Key fields | NAME, TYPE, ADDRESS |
| Why | Community layer — directory of religious institutions. |
| Volume | Trivial. |
| Schedule | Weekly |
| Status | **Ready to build** |

---

## Tier 2 — New Source Pattern Needed

These require new scraper infrastructure beyond the existing ArcGIS pattern.

### 6. Food Safety / Restaurant Inspections

| Property | Value |
|----------|-------|
| Source | Marion County Public Health Department |
| Access | HTML or PDF scraping from `marionhealth.org` |
| Why | Restaurant inspection scores and violations — one of the most-requested civic datasets in any city. |
| Challenge | No structured API known. May require Playwright or PDF extraction. |
| Status | Research needed |

### 7. Property Sales / Deed Records

| Property | Value |
|----------|-------|
| Source | Indiana County Auditor website |
| Access | Bulk download or scraping at `countyauditor.in.gov` |
| Why | Actual sale prices, deed transfers — fills the gap in existing parcel data (which is assessment-only). |
| Challenge | Each county has a different system. Hamilton County vs. Marion County differ. |
| Status | Research needed |

### 8. Building Permits (Accela REST API)

| Property | Value |
|----------|-------|
| Source | Indy Accela permitting system |
| Access | Accela REST API (needs endpoint discovery) or ArcGIS derived layer |
| Why | Construction permits tell you what's being built, renovated, demolished — leading indicator for neighborhood change. |
| Challenge | Accela Civic Platform API requires auth. May be easier through the ArcGIS-exported layer if one exists. |
| Status | Research needed |

---

## Tier 3 — Lower Priority

| # | Dataset | Source | Records | Why |
|---|---------|--------|---------|-----|
| 9 | Address Points | `sde_Addressing/sde_Addressing/MapServer/0` | 465K | Master address database — geocoding reference |
| 10 | Storm Sewer / Manhole | `Accela/AGIS_INDIANAPOLIS/MapServer/8,9` | 377K / 200K | Infrastructure asset tracking |
| 11 | Street Centerlines | `Accela/AGIS_INDIANAPOLIS/MapServer/7` | 71K | Street network |
| 12 | Census Tracts | `sde_Census/sde_Census/MapServer/0` | 253 | Demographic area boundaries |
| 13 | Police / Fire Districts | `sde_PublicSafetyBoundaries/...` | ~16 | Public safety zone maps |
| 14 | Charter Schools | `OEI/OEICharterSchool/MapServer/0` | 77 | School directory |
| 15 | Allergy / EPA Brownfields | US EPA public API | — | Environmental hazards near properties |

---

## Build Order

1. **Calls for Service** — highest user-facing value, same scraper pattern, demonstrates the expansion model
2. **VisionZero Crashes** — complements existing crash data with richer safety analytics
3. **Historic Sites** — quick win, small dataset, nice addition to parcel research
4. **Daycare Facilities + Places of Worship** — community directory layers
5. Tier 2 research — food safety, permits, sales data