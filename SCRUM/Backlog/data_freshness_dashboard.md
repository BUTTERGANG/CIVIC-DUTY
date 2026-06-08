---
title: "Data Freshness Indicators"
status: sprint
priority: P2
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: small
---

# Data Freshness Indicators

## Summary
Show when each data source was last successfully scraped on the dashboard stat cards, and surface a warning badge when a source is stale (>24h since last successful run).

## Value Proposition
`src/scheduler.ts` runs scrapers on cron (council 6am, bids 7am, zoning 8am, campaign Mon 9am) but there's no visibility into success or failure. When CivicClerk returns 429s or Playwright fails silently, users see stale data with no indication — eroding trust in the entire dashboard.

## Context
- Scheduler: `src/scheduler.ts` — wrap each scraper call to write result
- New table: `scraper_log` — columns: `source` (varchar), `run_at` (timestamp), `status` ('success'|'error'), `records_upserted` (int), `error_message` (text)
- New endpoint: `GET /api/dashboard/freshness` — returns last run per source
- Frontend: `CIVIC-DUTY-UI/src/pages/Dashboard.tsx` stat cards — add "Last updated: X ago" line and amber warning badge if >24h

## Acceptance Criteria
- [ ] `scraper_log` table created; each scraper run writes a row with status and record count
- [ ] `GET /api/dashboard/freshness` returns `{ source, last_run_at, status, records_upserted }` per source
- [ ] Dashboard stat cards display "Updated X ago" in small text below the count
- [ ] Sources stale >24h show an amber warning icon with tooltip "Data may be outdated"
- [ ] Error rows show the error_message in the tooltip

## Notes
P2: Small implementation, significant trust improvement. Small estimate — new table, scheduler hook, one endpoint, stat card UI tweak.
