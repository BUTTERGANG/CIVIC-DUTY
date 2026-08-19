# CivicDuty

A civic data aggregator covering **Fishers, Indianapolis, and Hamilton County, Indiana** — council votes, procurement bids, campaign finance, zoning changes, court records, public safety data, and county GIS layers (parcels, buildings, schools, parks, polling locations) in a single dashboard.

> Originally scoped to Fishers only (see "Regions" below) — Indianapolis public-safety data and Hamilton County GIS layers were added later. The expansion plan below reflects the actual Indy + HamCo build-out.

## Regions

| Region | Scope | Modules |
|---|---|---|
| **Fishers** | City-level, original scope | Council, bids, zoning, campaign finance, court lookup |
| **Indianapolis** | City-level, public safety | Council, incidents, crashes, citations, use-of-force, 311 service requests, parcels |
| **Hamilton County** | County-level GIS | Parcels (covers Fishers/Carmel/Noblesville/Westfield/etc.), buildings, tax districts, schools, parks, polling locations |

---

## Architecture

```
CIVIC-DUTY/
├── src/
│   ├── server.ts              # Express API + serves the built SPA (port from PORT env, default 3001)
│   ├── config.ts              # Loads .env; hard-fails at boot on missing DATABASE_URL/JWT_SECRET
│   ├── scheduler.ts           # node-cron jobs — see "Scraper schedules" below; wraps every scraper
│   │                          # in scheduleWithLogging() → writes scraper_log rows for freshness tracking
│   ├── db/
│   │   ├── schema.sql         # Table definitions + safe migrations (ALTER TABLE IF NOT EXISTS)
│   │   ├── index.ts           # pg Pool — connection string from config.ts (no localhost fallback)
│   │   └── init.ts            # Runs schema.sql on startup
│   ├── middleware/
│   │   ├── auth.ts            # requireAuth — verifies Bearer JWT, attaches req.user
│   │   └── rateLimit.ts       # api/auth/court-lookup limiters — see "Limits and error responses"
│   ├── lib/
│   │   └── http.ts            # clampLimit/clampOffset pagination bounds; sendError (no leaked pg text)
│   ├── scrapers/
│   │   ├── utils.ts           # Scraper interface, withBrowser() Playwright helper, Haversine distance
│   │   ├── council.ts         # CivicClerk OData API → council_votes; calls pdf.ts after sync
│   │   ├── pdf.ts             # Minutes + Agenda PDF extraction: vote counts, summaries, agenda items
│   │   ├── bids.ts            # Fishers city page + IDOA current + IDOA upcoming → bids
│   │   ├── campaign.ts        # Indiana FCPA CSV/ZIP streaming → campaign_contributions
│   │   ├── zoning.ts          # ArcGIS FeatureServer — public notices + dev projects → zoning_changes
│   │   ├── court.ts           # MyCase on-demand lookup via Playwright; no cron run
│   │   ├── arcgis.ts          # Shared ArcgisScraper base class — pagination, upsert, alert firing
│   │   ├── indy_council.ts    # Municode Meetings Portal (Indianapolis) → council_votes (city='indy')
│   │   ├── indy_incidents.ts  # ArcGIS (IMPD NIBRS) → incidents — non-spatial, no address/lat/lng
│   │   ├── indy_crashes.ts    # ArcGIS (IMPD Traffic_Crashes) → crashes
│   │   ├── indy_citations.ts  # ArcGIS (IMPD Citations) → citations
│   │   ├── indy_use_of_force.ts        # ArcGIS (IMPD UseOfForce) → use_of_force
│   │   ├── indy_service_requests.ts    # ArcGIS (RequestIndy 311) → service_requests
│   │   ├── indy_parcels.ts    # ArcGIS (MapIndy) → parcels, city='indy' — ~400K rows, weekly only
│   │   ├── hamco_parcels.ts   # ArcGIS (HamCo GIS) → parcels, city from CORPLIMIT field
│   │   ├── hamco_buildings.ts # ArcGIS (HamCo GIS) → buildings — city hardcoded 'hamco', no muni field
│   │   ├── hamco_tax_districts.ts      # ArcGIS (HamCo GIS) → tax_districts
│   │   ├── hamco_schools.ts   # ArcGIS (HamCo GIS) → schools
│   │   ├── hamco_parks.ts     # ArcGIS (HamCo GIS, Park Boundaries layer) → parks
│   │   └── hamco_polling.ts   # ArcGIS (HamCo Voting layer) → polling_locations
│   ├── routes/
│   │   ├── auth.ts            # POST /register, POST /login, GET /me (JWT auth)
│   │   ├── council.ts         # GET /api/council  (from, to, tags, q, limit, offset)
│   │   ├── bids.ts            # GET /api/bids  (category, agency, limit, offset)
│   │   ├── campaign.ts        # GET /api/campaign  (candidate, cycle, office, donor_name, min/max_amount)
│   │   │                      # GET /api/campaign/candidates  GET /api/campaign/offices
│   │   ├── zoning.ts          # GET /api/zoning  (source, status, from, to, lat, lng, radius_miles)
│   │   ├── court.ts           # GET /api/court   POST /api/court/lookup (on-demand MyCase)
│   │   ├── alerts.ts          # GET /api/alerts  (auth required)
│   │   │                      # GET/POST/DELETE /api/alerts/rules  PATCH /api/alerts/:id/read
│   │   ├── dashboard.ts       # GET /api/dashboard/summary
│   │   ├── cities.ts          # GET /api/cities  — metadata + live counts (only fishers/indy defined)
│   │   ├── incidents.ts, crashes.ts, citations.ts, use_of_force.ts, service_requests.ts
│   │   │                      # GET /api/<resource>  (city, district, from, to, limit, offset) + /:id
│   │   ├── parcels.ts         # GET /api/parcels  (city, address, owner, land_use, zoning, lat/lng/radius_miles)
│   │   └── buildings.ts, schools.ts, parks.ts, polling.ts, tax_districts.ts
│   │                          # GET /api/<resource>  (city + resource-specific filters) + /:id
│   └── alerts/
│       └── engine.ts          # Keyword + geo rule matching. runAlertEngineBatch() evaluates a
│                              # batch against one rules fetch; ruleMatches() is the pure predicate
│   └── __tests__/             # node:test suites — ArcGIS mapping, alert rules, pagination clamps
│                              # (excluded from tsc output; see "Tests")
├── .replit / replit.nix        # Replit config — Reserved VM, Nix chromium. See "Deploying"
├── Dockerfile                  # Multi-stage build: tsc backend + vite frontend → lean runtime image
├── run-scraper.ts              # Manual runner: npx ts-node run-scraper.ts [council|bids|campaign|zoning|...]
└── CIVIC-DUTY-UI/
    └── src/
        ├── api.ts                  # Typed fetch helpers + DB → UI field transforms; JWT auth headers
        ├── context/
        │   ├── AuthContext.tsx     # JWT stored in localStorage; restores session via /api/auth/me
        │   └── AlertsContext.tsx   # Polls /api/alerts every 60s; markRead + markAllRead
        ├── pages/
        │   ├── Dashboard.tsx       # Stat cards, aggregated feed, priority alerts
        │   ├── Council.tsx         # Events table with expandable agenda items
        │   ├── Bids.tsx            # Bid cards with status/agency filters
        │   ├── Zoning.tsx          # Split map: public notices (amber) + dev projects (indigo)
        │   ├── Campaign.tsx        # Contributions table with candidate/office/cycle/donor filters
        │   ├── Court.tsx           # Cached cases + on-demand MyCase lookup
        │   ├── Alerts.tsx          # Watchlist rules CRUD + triggered feed
        │   ├── Login.tsx           # Sign-in / register form
        │   └── Parcels.tsx, Buildings.tsx, Schools.tsx, Parks.tsx, Polling.tsx, TaxDistricts.tsx
        │                          # Hamilton County GIS layers
        │                          # Incidents, Crashes, Citations, Use of Force, Service Requests:
        │                          #   API routes + frontend pages
        └── components/
            └── Shared.tsx          # ModuleBadge, StatusChip, DocumentList, AlertCard, NavBar
```

---

## Tech stack

**Backend**
- Node.js 22+ + TypeScript (strict mode, CommonJS target)
- Express 5
- PostgreSQL 16 (via `pg` pool)
- `jsonwebtoken` + `bcryptjs` — JWT authentication
- Playwright (Chromium) — IDOA bids, Fishers bids, MyCase court lookups
- `pdf-parse` — Minutes + Agenda PDF text extraction
- `unzipper` + `csv-parse` — FCPA ZIP/CSV streaming pipeline
- `node-cron` — scheduled scraper runs
- `express-rate-limit` — auth, court-lookup and global API throttling
- `node:test` — unit tests, no external test framework

**Frontend**
- React + TypeScript + Vite 8
- Tailwind CSS v4
- React Router v6
- Recharts — sparklines and donut charts
- React Leaflet — zoning map with two layer groups (notices + dev projects)
- Lucide icons
- Route-level code splitting via `React.lazy` — Leaflet and Recharts load only with the pages that use them (`src/App.tsx`)

---

## Database

PostgreSQL database: `civic_duty`

**Core (Fishers + shared)**

| Table | Populated by | Dedup key | Key columns |
|---|---|---|---|
| `users` | Auth register | `email` | `email`, `password_hash`, `display_name` |
| `council_votes` | CivicClerk API + PDFs (Fishers) / Municode (Indy) | `event_id` | `title`, `date`, `category`, `status`, `tags`, `attached_pdfs` (JSONB), `summary`, `vote_counts` (JSONB), `agenda_items` (JSONB) |
| `bids` | Fishers + IDOA × 2 | `(source, bid_id)` or `(source, title) WHERE bid_id IS NULL` | `source`, `title`, `agency`, `description`, `close_date`, `status`, `documents` |
| `campaign_contributions` | Indiana FCPA 2000–present | `(donor_name, candidate, amount, filed_date)` | `candidate`, `committee`, `office`, `donor_name`, `donor_type`, `amount`, `filed_date`, `cycle` |
| `campaign_expenditures` | **Migrated, not populated** — no scraper or route writes to this table yet | `(donor_name, candidate, amount, filed_date)` | See `SCRUM/Backlog/fcpa_expenditure_ingestion.md` |
| `zoning_changes` | Fishers ArcGIS FeatureServer | `docket` (notices); `(project_name) WHERE source='dev_project'` | `source`, `address`, `docket`, `board`, `request_type`, `description`, `status`, `lat`, `lng`, `project_name`, `project_type` |
| `court_cases` | MyCase on-demand | `case_number` | `case_type`, `status`, `parties`, `next_hearing`, `judge` |
| `alert_rules` | User-created (auth required) | — | `user_id`, `module`, `keyword`, `lat`, `lng`, `radius_miles` |
| `alerts` | Alert engine on insert | — | `user_id`, `module`, `message`, `item_id`, `read` |
| `scraper_log` | Every scraper run (success or error), via `scheduleWithLogging()` in `scheduler.ts` | — | `source`, `run_at`, `status`, `records_upserted`, `error_message` |

**Indianapolis** (`city = 'indy'`)

| Table | Populated by | Dedup key |
|---|---|---|
| `incidents` | ArcGIS — IMPD NIBRS (non-spatial: no address/lat/lng, city/zip only) | `(city, incident_id)` |
| `crashes` | ArcGIS — IMPD Traffic Crashes | `(city, crash_id)` |
| `citations` | ArcGIS — IMPD Citations | `(city, citation_id)` |
| `use_of_force` | ArcGIS — IMPD Use of Force | `(city, report_id)` |
| `service_requests` | ArcGIS — RequestIndy 311 | `(city, request_id)` |
| `parcels` | ArcGIS — MapIndy (~400K rows, weekly cron) | `(city, parcel_id)` |

**Hamilton County** (`city = 'hamco'`, except `parcels` which is per-municipality via `CORPLIMIT`)

| Table | Populated by | Dedup key |
|---|---|---|
| `parcels` | HamCo GIS — covers Fishers/Carmel/Noblesville/Westfield/unincorporated | `(city, parcel_id)` |
| `buildings` | HamCo GIS — county-wide, no municipality field (`city` hardcoded `'hamco'`) | `(city, building_id)` |
| `tax_districts` | HamCo GIS | `(city, district_code)` |
| `schools` | HamCo GIS | `(city, name, address)` |
| `parks` | HamCo GIS, Park Boundaries layer only (Trails/Trailheads/Memorials layers exist but aren't scraped) | none — insert-only |
| `polling_locations` | HamCo Voting layer | `(city, name, address)` |

Initialize / re-run migrations:
```bash
npm run db:init
```

Schema is safe to re-run — all `CREATE TABLE` use `IF NOT EXISTS` and column additions use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

---

## Setup

### Prerequisites
- Node 18+
- PostgreSQL 16 (Homebrew: `brew install postgresql@16 && brew services start postgresql@16`)
- Playwright browsers: `npx playwright install chromium`

### First-time setup

```bash
# 1. Install dependencies
npm install
npx playwright install chromium

# 2. Create the database
createdb civic_duty

# 3. Configure environment
cp .env.example .env
# Edit .env — required:
#   DATABASE_URL=postgresql://<user>@localhost:5432/civic_duty
#   PORT=3333
#   JWT_SECRET=<long-random-string>

# 4. Initialize schema
npm run db:init

# 5. Start API server
npm run dev

# 6. Start UI dev server (separate terminal)
cd CIVIC-DUTY-UI && npm run dev
# → http://localhost:5173  (proxies /api → API server port)
```

### .env reference

```
DATABASE_URL=postgresql://youruser@localhost:5432/civic_duty
PORT=3333
JWT_SECRET=change-me-to-a-long-random-secret-before-deploying
ENABLE_SCHEDULER=true   # set false on any instance that isn't a single always-on process
```

> `DATABASE_URL` and `JWT_SECRET` are **required** — `src/config.ts` validates them at boot and exits with a readable message if either is missing, rather than failing later on the first query or login.

> The Vite proxy in `CIVIC-DUTY-UI/vite.config.ts` must point to the same port as `PORT`. Both default to `3333`.

---

## Deploying

### Serving model

In production the Express server serves the built frontend from the same origin as the API — `src/server.ts` mounts `express.static()` on `CIVIC-DUTY-UI/dist` plus an SPA fallback for client-side routes. The UI calls a relative `/api` base, so one port serves everything and no CORS or proxy config is involved. If `CIVIC-DUTY-UI/dist` is absent the server logs a warning and runs API-only.

Build both halves with:

```bash
npm run build:all      # tsc backend + vite frontend
npm start              # node dist/server.js
```

### The scheduler

`setupScheduler()` registers 17 cron jobs and runs inside the server process. It must run on **exactly one always-on instance** — several sources (CivicClerk especially) are rate-limited, and duplicate replicas would scrape them in parallel. Set `ENABLE_SCHEDULER=false` on anything that scales out or sleeps, and run the scheduler as a single separate deployment.

### Replit

`.replit` and `replit.nix` are checked in. Notes specific to that platform:

- **Deployment target is Reserved VM, not Autoscale.** Autoscale sleeps and scales to N instances, which breaks cron; the heavy scrapes (Indy parcels ~400K rows, FCPA first run 10–30 min) also outlive any Autoscale request.
- **Secrets** go in Replit Secrets, not a `.env` file — `DATABASE_URL` and `JWT_SECRET` at minimum.
- **`ENABLE_SCHEDULER` defaults to `false`** in `.replit`. Flip it to `true` only on the always-on deployment.
- **Playwright** uses the Nix-provided Chromium (`replit.nix`) rather than downloading its own, which fails against Replit's read-only Nix store. `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` makes `src/scrapers/utils.ts` resolve the binary from `PATH`. Without a working Chromium, the **bids** (Fishers + IDOA) and **court** lookup scrapers fail; council, campaign, zoning and all 12 ArcGIS scrapers are plain HTTP and unaffected.

---

## Tests

```bash
npm test        # backend unit tests (node:test, no extra deps)
```

Covers the ArcGIS request/response mapping layer and the alert rule matcher —
the two places where a mistake is silent rather than loud. A wrong ArcGIS field
name yields a null column, not an error, which is how all six Indianapolis
scrapers ran against a non-existent schema for months; `collectOutFields` and
`mapFeature` are pinned against fixture payloads so that fails visibly now.

Tests live in `src/__tests__` and are excluded from `tsc` output, so they don't
ship in the production build.

## Running scrapers manually

```bash
npx ts-node run-scraper.ts council    # CivicClerk events + Minutes PDFs + Agenda PDFs
npx ts-node run-scraper.ts bids       # Fishers + IDOA current + IDOA upcoming
npx ts-node run-scraper.ts campaign   # Indiana FCPA 2000–present (long on first run)
npx ts-node run-scraper.ts zoning     # Fishers ArcGIS — public notices + dev projects
```

> **First-time campaign finance run** — streams 27 years of statewide Indiana contribution ZIPs. Expect 10–30 minutes. Subsequent runs are fast — most rows hit `ON CONFLICT DO NOTHING`.

> **Minutes PDF rate limiting** — CivicClerk returns HTTP 429 if you download too fast. The scraper runs 1 PDF at a time with an 800ms delay. Failed rows are retried on the next run (query filters `WHERE summary IS NULL`).

---

## Scraper schedules (node-cron)

Every job below is wrapped in `scheduleWithLogging()` (`src/scheduler.ts`), which writes a `scraper_log` row per run for the dashboard's data-freshness indicators.

**Fishers**

| Scraper | Schedule | Source(s) |
|---|---|---|
| Council + PDF extraction | Daily 6am | CivicClerk OData API → Minutes PDFs → Agenda PDFs |
| Bids | Daily 7am | Fishers city page + IDOA current + IDOA upcoming |
| Zoning | Daily 8am | Fishers ArcGIS (public notices) + Fishers ArcGIS (dev projects) |
| Campaign finance | Mondays 9am | Indiana FCPA bulk CSV/ZIP |

**Indianapolis**

| Scraper | Schedule | Source(s) |
|---|---|---|
| Council | Daily 10am | Municode Meetings Portal |
| Incidents | Daily 11am | ArcGIS — IMPD NIBRS |
| Crashes | Daily 12pm | ArcGIS — IMPD Traffic Crashes |
| Citations | Daily 1pm | ArcGIS — IMPD Citations |
| Use of force | Daily 2pm | ArcGIS — IMPD Use of Force |
| Service requests | Daily 3pm | ArcGIS — RequestIndy 311 |
| Parcels | Weekly, Sun 2am | ArcGIS — MapIndy (~400K rows; first run 30–60 min) |

**Hamilton County**

| Scraper | Schedule | Source(s) |
|---|---|---|
| Parcels | Weekly, Sun 3am | HamCo GIS |
| Buildings | Weekly, Sun 4am | HamCo GIS |
| Tax districts | Weekly, Mon 5am | HamCo GIS |
| Schools | Weekly, Tue 5am | HamCo GIS |
| Parks | Weekly, Wed 5am | HamCo GIS |
| Polling locations | Weekly, Thu 5am | HamCo GIS |

Court is on-demand only — no scheduled cron run.

---

## API endpoints

### Auth
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/register` | Body: `{ email, password, display_name? }` → `{ token, user }` |
| `POST` | `/api/auth/login` | Body: `{ email, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | Bearer token required → `{ id, email, display_name }` |

### Limits and error responses

Every list endpoint takes `limit` (default 50, **capped at 500**) and `offset`.
Values above the cap, or junk, are coerced rather than rejected — see
`src/lib/http.ts`.

Rate limits (`src/middleware/rateLimit.ts`), returned with `RateLimit-*` headers:

| Scope | Limit |
|---|---|
| `/api/*` | 600 per 15 min |
| `POST /api/auth/login`, `/register` | 10 per 15 min (successful logins don't count) |
| `POST /api/court/lookup` | 20 per hour, per user |

5xx responses return `{ "error": "Internal server error", "ref": "<id>" }`. The
underlying error is logged server-side against that same ref — quote it when
reporting a failure. Error text is never returned to the caller, since Postgres
messages name tables, columns and constraints.

### Data (public read)
| Method | Path | Query params | Notes |
|---|---|---|---|
| `GET` | `/api/council` | `from`, `to`, `tags`, `limit`, `offset` | <details><summary>Example response</summary>\n\n```json\n[\n  {\n    \"id\": 123,\n    \"title\": \"City Council Meeting\",\n    \"date\": \"2024-03-18T18:30:00.000Z\",\n    \"category\": \"City Council\",\n    \"status\": \"past\",\n    \"tags\": [\"council\"],\n    \"summary\": \"A summary of the meeting...\",\n    \"vote_counts\": {\"yes\": 6, \"no\": 1, \"abstain\": 0},\n    \"agenda_items\": [\n      {\"label\": \"I.A.\", \"title\": \"Ordinance 123...\"}\n    ],\n    \"documents\": [\n      {\"label\": \"Agenda\", \"url\": \"...\"}\n    ]\n  }\n]\n```\n\n</details> |
| `GET` | `/api/council/:id` | — | |
| `GET` | `/api/bids` | `category`, `agency`, `status`, `min_value`, `max_value`, `limit`, `offset` | <details><summary>Example response</summary>\n\n```json\n[\n  {\n    \"id\": 456,\n    \"source\": \"idoa\",\n    \"bid_id\": \"EVT00012345\",\n    \"title\": \"Statewide Janitorial Services\",\n    \"agency\": \"Indiana Department of Administration\",\n    \"status\": \"open\",\n    \"close_date\": \"2024-04-30T15:00:00.000Z\",\n    \"posted_date\": \"2024-03-20T10:00:00.000Z\",\n    \"value_estimate\": 500000,\n    \"documents\": [\n      {\"label\": \"Solicitation Document\", \"url\": \"...\"}\n    ]\n  }\n]\n```\n\n</details> |
| `GET` | `/api/bids/:id` | — | |
| `GET` | `/api/campaign` | `candidate`, `cycle`, `office`, `donor_name`, `donor_type`, `min_amount`, `max_amount`, `limit`, `offset` | Ordered by `filed_date DESC` <details><summary>Example response</summary>\n\n```json\n[\n  {\n    \"id\": 789,\n    \"candidate\": \"John Doe\",\n    \"committee\": \"Committee to Elect John Doe\",\n    \"office\": \"Fishers City Council\",\n    \"cycle\": 2024,\n    \"donor_name\": \"Jane Smith\",\n    \"donor_type\": \"Individual\",\n    \"amount\": 250,\n    \"filed_date\": \"2024-01-15T00:00:00.000Z\"\n  }\n]\n```\n\n</details> |
| `GET` | `/api/campaign/candidates` | — | Distinct sorted candidate names |
| `GET` | `/api/campaign/offices` | — | Distinct sorted office names |
| `GET` | `/api/zoning` | `source`, `status`, `from`, `to`, `lat`, `lng`, `radius_miles`, `limit`, `offset` | Ordered by `scraped_at DESC` <details><summary>Example response</summary>\n\n```json\n[\n  {\n    \"id\": 101,\n    \"source\": \"public_notice\",\n    \"docket\": \"RZ-24-1\",\n    \"address\": \"123 Main St, Fishers, IN\",\n    \"request_type\": \"Rezoning\",\n    \"status\": \"scheduled\",\n    \"hearing_date\": \"2024-05-10T18:00:00.000Z\",\n    \"lat\": 39.95,\n    \"lng\": -86.01\n  }\n]\n```\n\n</details> |
| `GET` | `/api/zoning/:id` | — | |
| `GET` | `/api/court` | `limit`, `offset` | Cached cases only |
| `POST` | `/api/court/lookup` | Body: `{ case_number }` | **Bearer JWT required**, 20/hour per user. Checks DB cache first; Playwright fetch on miss |
| `GET` | `/api/dashboard/summary` | — | Counts + latest item per module |
| `GET` | `/api/cities` | — | City metadata (display name, modules, live counts). Only `fishers` and `indy` are defined in `CITY_META` — Hamilton County (`hamco`) data has no city-level entry here since it's county-scoped |

### Indianapolis & Hamilton County Data (all have frontend pages)

| Method | Path | Query params |
|---|---|---|
| `GET` | `/api/incidents`, `/api/crashes`, `/api/citations`, `/api/use-of-force`, `/api/service-requests` | `city`, `district`, `from`, `to`, `limit`, `offset` (+ resource-specific: e.g. `incident_type`) |
| `GET` | `/api/parcels` | `city`, `address`, `owner`, `land_use`, `zoning`, `lat`, `lng`, `radius_miles`, `limit`, `offset` |
| `GET` | `/api/buildings`, `/api/schools`, `/api/parks`, `/api/polling-locations`, `/api/tax-districts` | `city` + resource-specific filters, `limit`, `offset` |

All of the above also support `GET /:id`. All five public-safety resources have frontend pages at `/incidents`, `/crashes`, `/citations`, `/use-of-force`, and `/service-requests`.

### Alerts (Bearer JWT required)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/alerts` | `read`, `module` query params |
| `PATCH` | `/api/alerts/:id/read` | Mark single alert read |
| `GET` | `/api/alerts/rules` | User's watchlist rules |
| `POST` | `/api/alerts/rules` | Body: `{ module, keyword?, lat?, lng?, radius_miles? }` |
| `DELETE` | `/api/alerts/rules/:id` | Own rules only |

### Misc
| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Server liveness check |

### UI field transforms (`CIVIC-DUTY-UI/src/api.ts`)

| DB column | UI field | Notes |
|---|---|---|
| `vote_counts` (JSONB) | `votes: { yes, no, abstain }` | Defaults to `{0,0,0}` when null |
| `attached_pdfs` (JSONB array) | `documents: [{ label, url }]` | Strips `fileId` and `type` |
| `agenda_items` (JSONB array) | `agendaItems: AgendaItem[]` | `{ label, title, ordinance, resolution }` |
| `value_estimate` (TEXT) | `value_estimate: number \| null` | `parseFloat()` — null if not numeric |
| `bids.documents` (TEXT[]) | `documents: [{ label, url }]` | Label defaults to "Document" |
| alerts `message` | `summary` | — |

---

## Known issues / gotchas

- **CivicClerk API quirks:** The API paginates at 15 results per page and ignores the `$top` parameter. It's also not possible to get a total count via `$count=true` (it returns a 500 error).
- **Minutes PDF rate limiting:** The CivicClerk server will return HTTP 429 (Too Many Requests) if you download PDFs too quickly. The scraper runs 1 PDF at a time with an 800ms delay to avoid this. Failed rows are automatically retried on the next cron run.
- **IDOA pagination:** The page-size dropdown on the IDOA "Current Business Opportunities" page is a custom MUI component that can't be controlled via Playwright's `selectOption()`. Scraper uses Next-button pagination at 50 rows/page as a workaround.
- **Campaign finance first run:** The initial run of the campaign finance scraper is very long, taking 10–30 minutes to stream and process 27 years of statewide data. Subsequent runs are much faster.
- **Fishers bids page:** The city's bids page has very few active listings at any given time (typically 1–3).
- **MyCase CAPTCHA risk:** The MyCase court records site has a CAPTCHA. The current on-demand lookup is low-risk, but bulk scraping is not implemented and not recommended.
- **All 6 Indianapolis ArcGIS scrapers pointed at a dead domain until 2026-07-17.** `maps.indy.gov/arcgis/rest/services/...` 404'd entirely — not just `incidents`, all six (citations, crashes, incidents, use-of-force, 311, parcels) were built against a URL pattern and field schema that never existed in production. Real service catalog is `gis.indy.gov/server/rest/services/...`, discovered via ArcGIS Online's search API, with completely different field names (e.g. citations: `CitationNumber`/`Violation_Desc`, not `CITATION_ID`/`VIOLATION`). All 6 have been rewritten and live-verified against real data. See git history on `src/scrapers/indy_*.ts` and `src/scrapers/arcgis.ts` for details.
  - `incidents` (IMPD NIBRS) and `use_of_force` are non-spatial ArcGIS **Tables** — no address or lat/lng is published for either (privacy — Use of Force's `Gen_Address` is deliberately generalized). `hasGeometry: false` reflects that; don't expect these two to ever populate `lat`/`lng`.
  - `parcels` (Indianapolis) is a **polygon** layer. ArcGIS's `returnCentroid` param is accepted by this particular instance but silently doesn't populate `centroid` in the response, so `arcgis.ts` falls back to a vertex-average centroid computed from the polygon rings (`ringCentroid()`). It skips the closing vertex, which ArcGIS repeats from the first point — averaging it twice biased every centroid toward that corner (fixed 2026-07-29, covered by `src/__tests__/arcgis.test.ts`). Still an approximation rather than a true area-weighted centroid: fine for small parcels, would drift on very irregular large polygons.
  - Fixing this also surfaced a real bug in the shared `ArcgisScraper` base class: fields referenced only inside a custom mapper *function* (as opposed to a plain string field name) were never added to the ArcGIS `outFields` request — silently starving that column. `epochDateField()`/`epochTimestampField()` now tag their returned function with the source field name so the base class picks it up; this also fixes `hamco_parcels.ts`'s `last_sale_date`, which had the same silent gap.
  - This service is assessment data only — no zoning, year-built, or sale-history fields exist on it, so `zoning`, `year_built`, `last_sale_date`, `last_sale_price`, `building_area_sqft` stay null for Indianapolis parcels (not a bug — just not published here).
- **`campaign_expenditures` is a dead table.** Migration `001_scraper_log_and_expenditures.sql` created it, but no scraper writes to it and no route reads from it. See `SCRUM/Backlog/fcpa_expenditure_ingestion.md`.
- ~~**CI typecheck/build gates don't fail the build.**~~ All CI gates are now hard: backend typecheck, backend unit tests, backend build, frontend typecheck/build, frontend ESLint, and the Postgres smoke test. `continue-on-error` is gone from the workflow.
- **`hamco_buildings` has no municipality field** — the county GIS layer doesn't identify which city a building is in, so `city` is hardcoded to `'hamco'` pending a spatial join against corporate limits (same issue `hamco_parcels` solves via its `CORPLIMIT` field).

---

## Data sources

See [DATA_SOURCES.md](DATA_SOURCES.md) for full API shapes, field mappings, volume estimates, and implementation notes.

| Source | Method |
|---|---|
| CivicClerk — Fishers council events | REST API (OData), no auth |
| CivicClerk — Minutes + Agenda PDFs | HTTPS + pdf-parse v2 |
| Fishers city bids | Playwright, anchor extraction |
| IDOA current opportunities | Playwright, Next-button pagination |
| IDOA upcoming anticipated | Playwright |
| Indiana FCPA contributions | HTTPS + unzipper + csv-parse |
| Fishers ArcGIS — public notices | REST API (ArcGIS FeatureServer), no auth |
| Fishers ArcGIS — dev projects | REST API (ArcGIS FeatureServer), no auth |
| MyCase — Indiana courts | Playwright, on-demand only |
| Municode — Indianapolis council | REST API, no auth |
| ArcGIS — IMPD incidents/crashes/citations/use-of-force | REST API (ArcGIS FeatureServer), no auth |
| ArcGIS — RequestIndy 311 | REST API (ArcGIS FeatureServer), no auth |
| ArcGIS — MapIndy parcels | REST API (ArcGIS FeatureServer), no auth, ~400K rows |
| ArcGIS — Hamilton County GIS (parcels, buildings, tax districts, schools, parks, polling) | REST API (ArcGIS FeatureServer/MapServer), no auth |

---

## Roadmap / Next steps

Cross-project roadmap lives in `SCRUM/06_Programs/civic-duty/context.md`; in-repo task detail lives in `SCRUM/Backlog/*.md` and `TODO.md`. Prioritized next steps:

1. **Decide the fate of `campaign_expenditures`.** Table exists, nothing writes to it. Either finish `SCRUM/Backlog/fcpa_expenditure_ingestion.md` (wire up scraper + `/api/campaign/expenditures` route) or drop the table.
2. **Run the 6 Indy scrapers against a real Postgres instance** and confirm rows land correctly. Field mapping is now pinned by `src/__tests__/arcgis.test.ts`, but the upsert path hasn't been exercised against a real DB outside of CI — run `npx ts-node run-scraper.ts <module>` (or wait for the next scheduled cron) against a real `DATABASE_URL` and spot-check the tables.
3. **Widen test coverage beyond the mapping layer.** `src/__tests__` covers ArcGIS field mapping, alert rule matching, and pagination clamping — all pure logic. There is still no coverage of the route handlers, the upsert paths, or the PDF/CSV parsers; the Postgres smoke test in CI only asserts that `/health` returns 200.
4. **Build frontend pages in additional cities.** The Fishers and Indianapolis page sets are complete. A new city (e.g. Carmel via CivicEngage) would need a new scraper module (`src/scrapers/carmel_council.ts`), API routes, and a UI page set following the existing patterns. See `SCRUM/Backlog/multitown_civicengage_scraper.md`.
5. **Backlog items** (SCRUM/Backlog, status `sprint`): CivicClerk per-agenda-item PDF text extraction (P3), MyCase party-name search (P3).
