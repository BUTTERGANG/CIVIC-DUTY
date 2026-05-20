# CivicDuty UI

A civic intelligence dashboard for Fishers, Indiana — monitoring council votes, procurement bids, zoning changes, campaign finance, and court records in real-time.

## Tech stack

- **Framework**: React 19 + TypeScript + Vite 8
- **Styling**: Tailwind CSS v4 — deep navy glassmorphism design system
- **Charts**: Recharts — sparklines, donut charts
- **Maps**: React Leaflet — two-layer zoning map (public notices + dev projects)
- **Icons**: Lucide React
- **Routing**: React Router v6

## Getting started

```bash
cd CIVIC-DUTY-UI
npm install
npm run dev
# → http://localhost:5173  (proxies /api → backend on PORT from .env)
```

The backend must be running first. See the root `README.md` for full setup.

## Project structure

```
src/
├── api.ts                  # Typed fetch helpers; JWT auth headers; DB → UI field transforms
├── context/
│   ├── AuthContext.tsx     # JWT stored in localStorage (key: cd_token); session restored on load
│   └── AlertsContext.tsx   # Polls /api/alerts every 60s; exposes alerts, unreadCount, markRead, markAllRead
├── pages/
│   ├── Dashboard.tsx       # Stat cards + aggregated feed + priority alerts
│   ├── Council.tsx         # Events table with expandable agenda items (click row to expand)
│   ├── Bids.tsx            # Bid cards; filter by status and agency
│   ├── Zoning.tsx          # Split-panel map — public notices (amber) + dev projects (indigo)
│   │                       # Layer toggle: All / Hearings / Projects
│   ├── Campaign.tsx        # Contributions table; filter by candidate, office, cycle, donor name
│   │                       # Donut chart of contributions by donor type
│   ├── Court.tsx           # Cached cases list + on-demand MyCase lookup by case number
│   ├── Alerts.tsx          # Watchlist rules (keyword / location) + triggered feed
│   └── Login.tsx           # Sign-in / register form
└── components/
    └── Shared.tsx          # ModuleBadge, StatusChip, DocumentList, AlertCard, NavBar, EmptyState
```

## Authentication

JWT auth is handled by `AuthContext`. On load it calls `GET /api/auth/me` to restore an existing session from localStorage. Unauthenticated users see the Login page; authenticated users see the full app.

The JWT token is stored under the key `cd_token` in `localStorage` and sent as a `Bearer` token on every API request.

Alert rules and alert read/dismiss actions require authentication. All other data endpoints are publicly readable.

## Alert system

`AlertsContext` wraps the app and:
- Loads alerts on login, then polls every 60 seconds
- Exposes `markRead(id)` (single alert) and `markAllRead()` (all)
- Clicking an unread `AlertCard` anywhere in the app calls `markRead` and updates the badge count immediately (optimistic update, then PATCH to API)

## Design system

Core design tokens are in `src/index.css` as Tailwind v4 `@theme` directives:

| Token | Value |
|---|---|
| `--color-background` | `#020914` |
| `--color-surface` | `#070F1E` |
| `--color-primary` | `#3EA8FF` |
| `--color-success` | `#10d98a` |
| `--color-danger` | `#f04459` |
| `--color-warning` | `#f5a623` |
| Font (display) | Outfit |
| Font (UI) | Inter |

Reusable utility classes: `glass-card`, `glass-inset`, `btn-primary`, `btn-secondary`, `input-field`, `select-field`, `data-table`, `page-header`, `section-title`, `badge`.

## Production build

```bash
npm run build
# Output: dist/
```
