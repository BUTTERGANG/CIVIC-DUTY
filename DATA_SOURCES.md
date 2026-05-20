# Data Sources

## Scope
Fishers, Indiana civic data — council meetings, procurement bids, campaign finance, zoning, and court records. Statewide Indiana data included where it adds value (IDOA bids, FCPA campaign finance).

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
| 5 | Indiana FCPA campaign finance | HTTPS + CSV/ZIP | **Implemented** |
| 6 | Fishers ArcGIS — public notice zoning | REST API (ArcGIS FeatureServer) | **Implemented** |
| 7 | Fishers ArcGIS — development projects | REST API (ArcGIS FeatureServer) | **Implemented** |
| 8 | MyCase — Indiana Courts | Playwright, on-demand only | **Implemented** (no bulk cron) |
| 9 | Doxpop court data | Subscription API | Not pursued |
| 10 | IndianasBids.com historical bids | Paywalled | Not pursued |

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

