---
title: "Multi-Town: CivicEngage Scraper"
status: backlog
priority: P2
project: civic-duty
type: dev
agent_claimed: null
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T00:00:00Z'
tags: []
due: null
estimate: large
---

# Multi-Town: CivicEngage Scraper

## Summary
Add a second town's council meeting data by building a Playwright scraper for the CivicEngage platform, implementing the multi-town expansion plan documented in context.md.

## Value Proposition
The context.md Multi-Town Expansion Plan calls for 4 towns total. Towns 2 and 3 both use the CivicEngage platform. Expanding beyond Fishers makes CivicDuty a regional civic intelligence tool rather than a single-city dashboard — and CivicEngage is a reusable scraper that covers two towns at once.

## Context
- Documented: `context.md` Multi-Town Expansion Plan — "Town 2 (CivicEngage platform)"
- Existing model: `src/scrapers/council.ts` (CivicClerk) — new scraper follows same `Scraper` interface from `src/scrapers/utils.ts`
- Database: `council_votes` table needs a `town` discriminator column (currently implicit Fishers-only)
- Frontend: Council page dropdown to filter by town; Dashboard shows per-town stat cards
- Scheduler: add CivicEngage scraper run at 6:30am alongside existing CivicClerk at 6am

## Acceptance Criteria
- [ ] `src/scrapers/civicengage.ts` scrapes council meetings, agendas, and votes from a CivicEngage instance
- [ ] `town` column added to `council_votes` table; Fishers rows backfilled as 'fishers'
- [ ] `GET /api/council?town=<slug>` filter param added
- [ ] Frontend Council page shows a town selector dropdown; defaults to all towns
- [ ] Scheduler runs CivicEngage scraper at 6:30am daily
- [ ] New `06_Programs/civic-duty/context.md` entry updated with Town 2 name and CivicEngage URL

## Notes
P2: Large estimate — new Playwright scraper requires inspecting the CivicEngage DOM, handling pagination, and wiring a new cron job. Schema migration (adding `town` column) is low-risk. Identify the specific Town 2 CivicEngage URL before starting.
