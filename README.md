# CivicDuty

A civic data aggregator focused on **Fishers, Indiana** — tracking council votes, procurement bids, campaign finance, zoning changes, and court records in a single dashboard.

---

## Architecture

```
CIVIC-DUTY/
├── src/
│   ├── server.ts              # Express API server (port from PORT env, default 3001)
│   ├── scheduler.ts           # node-cron jobs: council 6am, bids 7am, zoning 8am, campaign Mon 9am
│   ├── db/
│   │   ├── schema.sql         # Table definitions + safe migrations (ALTER TABLE IF NOT EXISTS)
│   │   ├── index.ts           # pg Pool — reads DATABASE_URL from .env
│   │   └── init.ts            # Runs schema.sql on startup
│   ├── middleware/
│   │   └── auth.ts            # requireAuth — verifies Bearer JWT, attaches req.user
│   ├── scrapers/
│   │   ├── utils.ts           # Scraper interface, withBrowser() Playwright helper, Haversine distance
│   │   ├── council.ts         # CivicClerk OData API → council_votes; calls pdf.ts after sync
│   │   ├── pdf.ts             # Minutes + Agenda PDF extraction: vote counts, summaries, agenda items
│   │   ├── bids.ts            # Fishers city page + IDOA current + IDOA upcoming → bids
│   │   ├── campaign.ts        # Indiana FCPA CSV/ZIP streaming → campaign_contributions
│   │   ├── zoning.ts          # ArcGIS FeatureServer — public notices + dev projects → zoning_changes
│   │   └── court.ts           # MyCase on-demand lookup via Playwright; no cron run
│   ├── routes/
│   │   ├── auth.ts            # POST /register, POST /login, GET /me (JWT auth)
│   │   ├── council.ts         # GET /api/council  (from, to, tags, limit, offset)
│   │   ├── bids.ts            # GET /api/bids  (category, agency, limit, offset)
│   │   ├── campaign.ts        # GET /api/campaign  (candidate, cycle, office, donor_name, min/max_amount)
│   │   │                      # GET /api/campaign/candidates  GET /api/campaign/offices
│   │   ├── zoning.ts          # GET /api/zoning  (source, status, from, to, lat, lng, radius_miles)
│   │   ├── court.ts           # GET /api/court   POST /api/court/lookup (on-demand MyCase)
│   │   ├── alerts.ts          # GET /api/alerts  (auth required)
│   │   │                      # GET/POST/DELETE /api/alerts/rules  PATCH /api/alerts/:id/read
│   │   └── dashboard.ts       # GET /api/dashboard/summary
│   └── alerts/
│       └── engine.ts          # Keyword + geo rule matching; fires on each new scraper insert
├── run-scraper.ts              # Manual runner: npx ts-node run-scraper.ts [council|bids|campaign|zoning]
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
        │   └── Login.tsx           # Sign-in / register form
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

**Frontend**
- React + TypeScript + Vite 8
- Tailwind CSS v4
- React Router v6
- Recharts — sparklines and donut charts
- React Leaflet — zoning map with two layer groups (notices + dev projects)
- Lucide icons

---

## Database

PostgreSQL database: `civic_duty`

| Table | Populated by | Dedup key | Key columns |
|---|---|---|---|
| `users` | Auth register | `email` | `email`, `password_hash`, `display_name` |
| `council_votes` | CivicClerk API + PDFs | `event_id` | `title`, `date`, `category`, `status`, `tags`, `attached_pdfs` (JSONB), `summary`, `vote_counts` (JSONB), `agenda_items` (JSONB) |
| `bids` | Fishers + IDOA × 2 | `(source, bid_id)` or `(source, title) WHERE bid_id IS NULL` | `source`, `title`, `agency`, `description`, `close_date`, `status`, `documents` |
| `campaign_contributions` | Indiana FCPA 2000–present | `(donor_name, candidate, amount, filed_date)` | `candidate`, `committee`, `office`, `donor_name`, `donor_type`, `amount`, `filed_date`, `cycle` |
| `zoning_changes` | Fishers ArcGIS FeatureServer | `docket` (notices); `(project_name) WHERE source='dev_project'` | `source`, `address`, `docket`, `board`, `request_type`, `description`, `status`, `lat`, `lng`, `project_name`, `project_type` |
| `court_cases` | MyCase on-demand | `case_number` | `case_type`, `status`, `parties`, `next_hearing`, `judge` |
| `alert_rules` | User-created (auth required) | — | `user_id`, `module`, `keyword`, `lat`, `lng`, `radius_miles` |
| `alerts` | Alert engine on insert | — | `user_id`, `module`, `message`, `item_id`, `read` |

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
```

> The Vite proxy in `CIVIC-DUTY-UI/vite.config.ts` must point to the same port as `PORT`. Both default to `3333`.

---

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

| Scraper | Schedule | Source(s) |
|---|---|---|
| Council + PDF extraction | Daily 6am | CivicClerk OData API → Minutes PDFs → Agenda PDFs |
| Bids | Daily 7am | Fishers city page + IDOA current + IDOA upcoming |
| Zoning | Daily 8am | Fishers ArcGIS (public notices) + Fishers ArcGIS (dev projects) |
| Campaign finance | Mondays 9am | Indiana FCPA bulk CSV/ZIP |

Court is on-demand only — no scheduled cron run.

---

## API endpoints

### Auth
| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/auth/register` | Body: `{ email, password, display_name? }` → `{ token, user }` |
| `POST` | `/api/auth/login` | Body: `{ email, password }` → `{ token, user }` |
| `GET` | `/api/auth/me` | Bearer token required → `{ id, email, display_name }` |

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
| `POST` | `/api/court/lookup` | Body: `{ case_number }` | Checks DB cache first; Playwright fetch on miss |
| `GET` | `/api/dashboard/summary` | — | Counts + latest item per module |

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
