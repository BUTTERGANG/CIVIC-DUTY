# Data Sources

## Scope
Fishers, Indianapolis, and Hamilton County, Indiana civic data — council meetings, procurement bids, campaign finance, zoning, court records, public safety incidents, and county GIS layers (parcels, buildings, schools, parks, polling). Statewide Indiana data included where it adds value (IDOA bids, FCPA campaign finance).

**Note:** Sources 11–22 (Indianapolis + Hamilton County) were added without an accompanying update to this doc, `README.md`, or the roadmap. This pass (2026-07-17) reconciled all three docs against the actual code, and in the process found that all six Indianapolis ArcGIS sources (12–17) had never actually worked — `maps.indy.gov` 404'd entirely. Real endpoints (on `gis.indy.gov`) were found and all six scrapers rewritten and live-verified against real data; see each source's entry below and `src/scrapers/indy_*.ts` / `src/scrapers/arcgis.ts` git history for detail. Documented at lower fidelity than sources 1–10 for the rest; see the scraper source files directly (`src/scrapers/indy_*.ts`, `src/scrapers/hamco_*.ts`) for exact field mappings.

---

## Implementation status

| # | Source | Method | Status |
|---|---|---|---|
| 1 | CivicClerk — Fishers council events | REST API (no auth) | **Implemented** |
| 1a | CivicClerk — Minutes PDF extraction | HTTPS + pdf-parse | **Implemented** |
| 1b | CivicClerk — Agenda PDF parsing | HTTPS + pdf-parse | **Implemented** |
| 2 | Fishers city bids page | Playwright | **Implemented** |
| 3 | IDOA current business opportunities | Playwright (paginated) | **Implemented** |
| 4 | IDOA upcoming anticipated solicitations | Playwright | **Implemented** |
| 5 | Indiana FCPA campaign finance (contributions) | HTTPS + CSV/ZIP | **Implemented** |
| 5a | Indiana FCPA campaign finance (expenditures) | HTTPS + CSV/ZIP | **Not implemented** — `campaign_expenditures` table migrated but no scraper/route (see `SCRUM/Backlog/fcpa_expenditure_ingestion.md`) |
| 6 | Fishers ArcGIS — public notice zoning | REST API (ArcGIS FeatureServer) | **Implemented** |
| 7 | Fishers ArcGIS — development projects | REST API (ArcGIS FeatureServer) | **Implemented** |
| 8 | MyCase — Indiana Courts | Playwright, on-demand only | **Implemented** (no bulk cron) |
| 9 | Doxpop court data | Subscription API | Not pursued |
| 10 | IndianasBids.com historical bids | Paywalled | Not pursued |
| 11 | Municode — Indianapolis council meetings | REST API (no auth) | **Implemented** |
| 12 | ArcGIS — IMPD Incidents (NIBRS) | REST API (ArcGIS Table, non-spatial) | **Implemented, live-verified 2026-07-17** — no address/lat/lng published |
| 13 | ArcGIS — IMPD Traffic Crashes | REST API (ArcGIS FeatureServer) | **Implemented, live-verified 2026-07-17** |
| 14 | ArcGIS — IMPD Citations | REST API (ArcGIS FeatureServer) | **Implemented, live-verified 2026-07-17** |
| 15 | ArcGIS — IMPD Use of Force | REST API (ArcGIS Table, non-spatial) | **Implemented, live-verified 2026-07-17** — generalized address only, no lat/lng |
| 16 | ArcGIS — RequestIndy 311 service requests | REST API (ArcGIS FeatureServer) | **Implemented, live-verified 2026-07-17** |
| 17 | ArcGIS — MapIndy parcels | REST API (ArcGIS MapServer, polygon) | **Implemented, live-verified 2026-07-17** — ~400K rows, weekly cron only |
| 18 | ArcGIS — Hamilton County parcels | REST API (ArcGIS FeatureServer) | **Implemented** |
| 19 | ArcGIS — Hamilton County building footprints | REST API (ArcGIS FeatureServer) | **Implemented** — no municipality field, `city` hardcoded |
| 20 | ArcGIS — Hamilton County tax districts | REST API (ArcGIS FeatureServer) | **Implemented** |
| 21 | ArcGIS — Hamilton County schools | REST API (ArcGIS FeatureServer) | **Implemented** |
| 22 | ArcGIS — Hamilton County parks (boundaries layer) | REST API (ArcGIS MapServer) | **Implemented** — Trails/Trailheads/Memorials layers exist but not scraped |
| 23 | ArcGIS — Hamilton County polling locations | REST API (ArcGIS FeatureServer) | **Implemented** |

---

## 1. CivicClerk — Fishers Agenda Center

**Portal:** https://fishersin.portal.civicclerk.com/
**Scraper:** `src/scrapers/council.ts`
**Schedule:** Daily 6am

### API
Base: `https://fishersin.api.civicclerk.com/v1/`
No authentication required. OData REST API.

| Endpoint | Notes |
|---|---|
| `GET /Events?$filter=startDateTime ge {date}&$orderby=startDateTime asc` | Paginated event list. 15 results/page via `@odata.nextLink` + `$skiptoken`. |
| `GET /EventCategories` | All committee/category names. |
| `GET /Meetings/GetMeetingFileStream(fileId=####,plainText=false)` | Download a PDF by fileId. No auth. |

### Implementation
- Ingests from `2023-01-04` (earliest entry in portal) through present
- Follows `@odata.nextLink` cursor pagination
- Upserts on `event_id`; detects insert vs update via `(xmax = 0) AS is_insert`
- Excludes Agenda Packets (~10 MB each) — stores `fileId` only for on-demand fetch
- Derives `status` (`upcoming`/`past`) from `startDateTime` vs now
- Derives `tags` from `categoryName` via keyword matching (council, planning, zoning, etc.)

### PDF extraction (`src/scrapers/pdf.ts`)

Two functions run after each council sync:

**`processMinutesPdfs()`**
- Finds rows with a Minutes PDF but no `summary`
- Downloads first 5 pages; extracts summary (first substantive paragraph ≤500 chars)
- `extractVoteCounts()`: 6-pattern priority chain:
  1. `APPROVED/PASSED/ADOPTED X-Y` (most common Fishers format)
  2. `Ayes: X Nays: Y Abstain: Z`
  3. `Yeas: X Nays: Y`
  4. `voted N to M`
  5. `X-Y` near vote keyword + sanity check (≤15)
  6. `unanimous` → present count or 7
- Concurrency: 1 PDF at a time with 800ms delay (CivicClerk rate limits at ~429)

**`processAgendaPdfs()`**
- Finds rows with an Agenda PDF but null `agenda_items`
- `extractAgendaItems()`: parses Roman numeral / alpha / numeric section labels; extracts ordinance (`Ordinance No. YYYY-NN`) and resolution numbers; caps at 50 items
- Stores as `agenda_items JSONB` — `[{ label, title, ordinance, resolution }]`

### Schema mapping
| API field | DB column |
|---|---|
| `id` | `council_votes.event_id` |
| `eventName` | `council_votes.title` |
| `startDateTime` | `council_votes.date` |
| `categoryName` | `council_votes.category`, `council_votes.tags` |
| `eventLocation` | `council_votes.location` |
| `publishedFiles[]` (excl. Packet) | `council_votes.attached_pdfs` (JSONB) |
| Minutes PDF text | `council_votes.summary`, `council_votes.vote_counts` |
| Agenda PDF text | `council_votes.agenda_items` (JSONB) |

### Notes
- No Playwright needed — pure Node `https` module
- `$top` is ignored by the server (caps at 15); always follow `@odata.nextLink`
- `$count=true` returns HTTP 500 — not supported

---

## 2. Fishers Bids & Proposals

**Page:** https://fishersin.gov/do-business-here/bids-proposals/
**Scraper:** `src/scrapers/bids.ts` → `scrapeFishersBids()`
**Schedule:** Daily 7am (shared with IDOA sources)

### Implementation
- Playwright `domcontentloaded` + 2s wait
- Text extraction from main content area; regex for `"Closing date: ..."` lines
- PDF/document links harvested separately via `a[href]` scan
- Upserts on `(source='fishers', title)` partial unique index

### Schema mapping
| Page field | DB column |
|---|---|
| Bid title | `bids.title` |
| Closing date | `bids.close_date` |
| PDF links | `bids.documents` (TEXT[]) |
| (fixed) | `bids.agency` = "City of Fishers" |
| (fixed) | `bids.status` = "open", `bids.source` = "fishers" |

---

## 3. IDOA — Current Business Opportunities (statewide)

**Page:** https://www.in.gov/idoa/procurement/current-business-opportunities/
**Scraper:** `src/scrapers/bids.ts` → `scrapeIdoaCurrent()`
**Schedule:** Daily 7am

### Implementation
- Playwright `domcontentloaded` + 6s wait (MUI table render time)
- Next-button pagination (page-size dropdown is custom MUI — `selectOption()` fails)
- Constructs document ZIP URL from Event ID
- Upserts on `(source='idoa', bid_id)`

### Schema mapping
| Column | DB column |
|---|---|
| Event Name | `bids.title` |
| Agency | `bids.agency` |
| Event ID | `bids.bid_id` |
| Event Description | `bids.description` |
| Response Due By | `bids.close_date` |
| Contact | `bids.contact` |
| ZIP doc URL | `bids.documents` |
| (fixed) | `bids.status` = "open", `bids.source` = "idoa" |

---

## 4. IDOA — Upcoming Anticipated Bidding Opportunities (statewide)

**Page:** https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/
**Scraper:** `src/scrapers/bids.ts` → `scrapeIdoaUpcoming()`
**Schedule:** Daily 7am

### Schema mapping
| Column | DB column |
|---|---|
| Title | `bids.title` |
| Agency | `bids.agency` |
| Brief Description | `bids.description` |
| Event Type | `bids.category` |
| (fixed) | `bids.status` = "anticipated", `bids.source` = "idoa_upcoming" |

---

## 5. Indiana FCPA — Campaign Finance

**URL:** https://campaignfinance.in.gov/PublicSite/Reporting/DataDownload.aspx
**Scraper:** `src/scrapers/campaign.ts`
**Schedule:** Mondays 9am

### Download mechanism
- Pre-generated static ZIP files — one per year
- Coverage: **2000–present** (~27 years)
- Plain HTTPS GET — no login, no browser needed

### URL pattern
```
https://campaignfinance.in.gov/PublicSite/Docs/BulkDataDownloads/{YEAR}_ContributionData.csv.zip
```

### Implementation
- Streams each ZIP → `unzipper.ParseOne()` → `csv-parse` — no disk writes
- Batch inserts 500 rows at a time with multi-row `VALUES` clause
- `ON CONFLICT (donor_name, candidate, amount, filed_date) DO NOTHING`
- 500ms pause between years to avoid hammering the server

### Contribution CSV → DB mapping
| CSV column | DB column |
|---|---|
| `CandidateName` (falls back to `Committee`) | `candidate` |
| `Committee` | `committee` |
| `CommitteeType` | `committee_type` |
| `Name` | `donor_name` |
| `ContributorType` | `donor_type` |
| `Amount` | `amount` |
| `ContributionDate` | `filed_date` |
| (year of file) | `cycle` |

### API filters
`/api/campaign` supports: `candidate` (ILIKE), `cycle`, `office` (ILIKE), `donor_name` (ILIKE), `donor_type`, `min_amount`, `max_amount`, `limit`, `offset`. Results ordered by `filed_date DESC`.

---

## 6 & 7. Fishers ArcGIS — Zoning / Development Projects

**ArcGIS REST base:** `https://services.arcgis.com/CLuli6D9IiF45RRj/arcgis/rest/services/`
**Scraper:** `src/scrapers/zoning.ts`
**Schedule:** Daily 8am

### Endpoints

| Layer | FeatureServer | `source` column value |
|---|---|---|
| Public Notice Points (hearings) | `PublicNoticePoints_ViewOnly/FeatureServer/0/query` | `public_notice` |
| Development Projects | `Development_Projects_view/FeatureServer/0/query` | `dev_project` |

No authentication required. Plain JSON response.

### Public notices — key fields

| ArcGIS attribute | DB column |
|---|---|
| `PropertyAddress` / `MeetingAddress` | `address` |
| `Petitioner` | `applicant` |
| `Docket` (e.g. "RZ-26-3") | `docket` |
| `Type` (board name) | `board` |
| Docket prefix (RZ, VA, SE…) | `request_type` |
| `Request` (full description) | `description` |
| Parsed from `Request` | `from_zone`, `to_zone` |
| `MeetingDate` | `hearing_date` |
| `CreationDate` | `filed_date` |
| `CityStaff` / `CityStaffEmail` | `city_staff`, `city_staff_email` |
| `geometry.x` / `.y` (outSR=4326) | `lng`, `lat` |
| `MeetingDate > now` | `status` = "scheduled" / "heard" |

Conflict resolution: upsert on `docket` (updates status, description, board on re-run); fallback to `(address, filed_date)` for notices without a docket number.

### Development projects — key fields

| ArcGIS attribute | DB column |
|---|---|
| `Name` | `project_name` |
| `Type` | `project_type` |
| `Location` | `address` |
| `Applicant` | `applicant` |
| `Description` | `description` |
| `Status` (lowercased) | `status` |
| `ContactName` / `ContactEmail` | `contact_name`, `contact_email` |
| `Est_Completion` | `est_completion` |
| `feature.centroid.x/y` (returnCentroid=true) | `lng`, `lat` |

Conflict resolution: `ON CONFLICT (project_name) WHERE source = 'dev_project'`.

### API filter
`/api/zoning` supports `source` param to filter to one layer, e.g. `?source=public_notice`.

### Frontend
Zoning page renders two `LayerGroup`s in Leaflet:
- **Public notices** — default amber markers
- **Dev projects** — indigo markers (via CSS `hue-rotate(200deg)`)

Layer toggle in page header: All / Hearings / Projects

---

## 8. MyCase — Indiana Courts Public Search

**URL:** https://public.courts.in.gov/mycase/#/vw/Search
**Scraper:** `src/scrapers/court.ts` → `lookupCaseByNumber()`
**Route:** `POST /api/court/lookup`
**Status: On-demand only — no cron run**

### Flow
1. Client sends `{ case_number }` to `POST /api/court/lookup`
2. Backend checks `court_cases` table cache first → returns with `source: "cache"`
3. On cache miss: Playwright opens MyCase, selects "Case Number" tab, submits, parses result table
4. Result saved to `court_cases` → returned with `source: "mycase"`

### Case number format (Indiana)
```
29D01-2501-PL-000123
└─┬─┘ └──┬──┘ ┬  └──┬───┘
  │      │    │      └── sequence number
  │      │    └── case type (PL, F6, MF, etc.)
  │      └── year filed
  └── court code (29 = Hamilton County)
```

### Decision: on-demand only
- CAPTCHA template is present — bulk ingestion risks rate limiting
- Most cases have no civic relevance
- Use for targeted lookups (e.g. a business name from a bid appearing in court records)

---

## 9. Doxpop — Indiana Court Data

**Status: Not pursued — subscription required**

Covers Hamilton County (Fishers). High-volume API requires contractual agreement. Use MyCase (source #8) for free public access.

---

## 10. IndianasBids.com — Historical Bid Results

**Status: Not pursued — paywalled**

Full bid opportunities and results require paid subscription. No API discovered.

---

## 11. Municode — Indianapolis Council Meetings

**Portal:** https://indianapolis-in.municode.com/
**Scraper:** `src/scrapers/indy_council.ts`
**Schedule:** Daily 10am

Same shape as Fishers CivicClerk (source #1): plain `https` GET against `https://indianapolis-in.municode.com/api/Meetings`, no auth, ingests from `2023-01-01`. Writes into the same `council_votes` table with `city='indy'`.

---

## 12–16. ArcGIS — IMPD & 311 (Indianapolis Public Safety)

**Scraper base:** `src/scrapers/arcgis.ts` (`ArcgisScraper`) — shared pagination/upsert/alert-firing logic used by all Indianapolis and Hamilton County sources below.
**Schedule:** Daily, staggered 11am–3pm (see README "Scraper schedules")

All five originally pointed at `maps.indy.gov/arcgis/rest/services/...`, which 404'd entirely — the whole path doesn't exist on that domain. Real endpoints (below) were found 2026-07-17 by querying ArcGIS Online's search API for `owner:IndyGIS`, which resolves to the City of Indianapolis/Marion County GIS org's actual hosted services on `gis.indy.gov`. All five rewritten and live-verified against real data (field names, sample values) that day.

| # | Source | Scraper | Table | Service URL |
|---|---|---|---|---|
| 12 | IMPD Incidents (NIBRS) | `indy_incidents.ts` | `incidents` | `gis.indy.gov/server/rest/services/IMPD/IMPD_NIBRS_Public/FeatureServer/1` |
| 13 | IMPD Traffic Crashes | `indy_crashes.ts` | `crashes` | `gis.indy.gov/server/rest/services/IMPD/IMPD_Crash_Public/FeatureServer/0` |
| 14 | IMPD Citations | `indy_citations.ts` | `citations` | `gis.indy.gov/server/rest/services/IMPD/IMPD_Citations_Public/FeatureServer/0` |
| 15 | IMPD Use of Force | `indy_use_of_force.ts` | `use_of_force` | `gis.indy.gov/server/rest/services/IMPD/IMPD_UseOfForce_Public/FeatureServer/0` |
| 16 | RequestIndy 311 (RIMAC) | `indy_service_requests.ts` | `service_requests` | `gis.indy.gov/server/rest/services/OpenData/ODP_RIMACServiceRequests/FeatureServer/0` |

Notes specific to this rewrite:
- **#12 and #15 are non-spatial ArcGIS Tables** (`geometryType: None`), not Feature Layers — IMPD does not publish exact incident locations. #12 has no address field at all (only city/zip); #15's `Gen_Address` is a deliberately generalized address, not the exact location. Both scrapers set `hasGeometry: false`; `lat`/`lng` will always be null for these two tables — that's correct, not a bug.
- **#14 (Citations):** `citation_id` maps to `OBJECTID`, not the source's `CitationNumber` — a single citation can list multiple violations, each as its own row sharing one `CitationNumber`, confirmed via live sample data (two rows, same `CitationNumber`, different `Violation_Desc`). Using `CitationNumber` as the dedup key would silently drop all but one violation per citation.
- **#15 (Use of Force):** no `incident_type` or `officer_years_experience` field exists in the source; `force_type` is derived from which of the taser/physical/K9/less-lethal/OC force-application flags are non-zero on the row.
- Rewriting these also surfaced a latent bug in the shared `ArcgisScraper` base class: fields referenced only inside a custom mapper *function* (as opposed to a plain string field name) were never added to the ArcGIS request's `outFields`, so e.g. every `epochTimestampField(...)`-mapped date column was silently always null. Fixed by having `epochDateField()`/`epochTimestampField()` tag their returned function with the source field name so the base class's field collector picks it up (`arcgis.ts`). This also fixes `hamco_parcels.ts`'s `last_sale_date`, which had the same gap.

All five upsert on `(city, <resource>_id)`, dedup via the standard ArcGIS `xmax = 0` insert-vs-update pattern in `ArcgisScraper.upsertRow()`.

---

## 17. ArcGIS — MapIndy Parcels

**Scraper:** `src/scrapers/indy_parcels.ts`
**Service URL:** `gis.indy.gov/server/rest/services/MapIndy/MapIndyProperty/MapServer/10` (rewritten 2026-07-17 — see #12–16 above for why)
**Table:** `parcels` (`city='indy'`)
**Schedule:** Weekly, Sunday 2am

Large dataset (~400K records) — the scraper's own comment flags a 30–60 minute first run. Deliberately not on a daily cron.

This is a **polygon** layer (parcel boundaries, not points). ArcGIS's `returnCentroid` request param is accepted by this specific instance but silently doesn't populate `centroid` in the response (confirmed live), so `arcgis.ts` falls back to a vertex-average centroid computed from the polygon's outer ring (`ringCentroid()` in `arcgis.ts`) — an approximation, not a true area-weighted centroid, but fine for parcel-sized polygons.

This service is assessment data only — it has no zoning, year-built, or sale-history fields, so `zoning`, `year_built`, `last_sale_date`, `last_sale_price`, and `building_area_sqft` are left unmapped (stay null) for Indianapolis parcels rather than guessed at.

⚠ `returnCentroid=true` triggers a 400 error on **point**-geometry ArcGIS services — it must only be sent for polygon layers. `arcgis.ts` gates it behind a new `useCentroid` config flag (only set on `indy_parcels.ts`) rather than sending it on every request, which was an actual regression caught during this rewrite (it broke all 5 of the point-based sources above until fixed).

---

## 18–23. ArcGIS — Hamilton County GIS

**Base:** `https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/`
**Schedule:** Weekly, staggered Sun–Thu (see README "Scraper schedules")

| # | Source | Scraper | Table | Notes |
|---|---|---|---|---|
| 18 | Parcels | `hamco_parcels.ts` | `parcels` | Covers Fishers, Carmel, Noblesville, Arcadia, Atlanta, Cicero, Sheridan, Westfield, and unincorporated areas. `CORPLIMIT` field determines per-row `city` value — this is the only Hamilton County source with real per-municipality attribution. |
| 19 | Building footprints | `hamco_buildings.ts` | `buildings` | **No municipality field in the source layer** — `city` is hardcoded `'hamco'`. Comment in the scraper notes a spatial join against corporate limits is needed to attribute buildings to a city; not yet done. |
| 20 | Tax districts | `hamco_tax_districts.ts` | `tax_districts` | — |
| 21 | Schools | `hamco_schools.ts` | `schools` | — |
| 22 | Parks | `hamco_parks.ts` | `parks` | HamCoParks service has 5 layers (Boundaries, Trails, Trailheads, Memorials, Rules Signs); only Park Boundaries (layer 4) is scraped. No dedup key — insert-only. |
| 23 | Polling locations | `hamco_polling.ts` | `polling_locations` | From the HamCo Voting layer. |

---

