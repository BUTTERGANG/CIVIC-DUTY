---
title: "FCPA Expenditure Ingestion"
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
estimate: medium
---

# FCPA Expenditure Ingestion

## Summary
Ingest the Indiana FCPA expenditure CSV (which includes an `OfficeSought` field) to enable Fishers-specific campaign expenditure tracking alongside the existing contributions data.

## Value Proposition
Documented in `TODO.md`. The existing `src/scrapers/campaign.ts` ingests contributions (money in) but not expenditures (money out). The `OfficeSought` field in the expenditure CSV allows filtering to Fishers City Council races specifically — giving users a complete picture of local campaign finance: who gave, how much, and what it was spent on.

## Context
- Documented: `TODO.md` — "FCPA expenditure ingestion"
- Existing scraper: `src/scrapers/campaign.ts` — HTTPS + CSV/ZIP streaming pipeline
- FCPA expenditure CSV format: similar to contributions; key new field is `OfficeSought`
- Option A: new `campaign_expenditures` table; Option B: extend `campaign_contributions` with a `record_type` discriminator
- Existing route: `src/routes/campaign.ts` — extend with `/api/campaign/expenditures` endpoint

## Acceptance Criteria
- [ ] `campaign_expenditures` table (or extended contributions table) stores FCPA expenditure rows
- [ ] Scraper ingests expenditure ZIP/CSV on same Monday 9am cron as contributions
- [ ] Filter by `OfficeSought` to show Fishers City Council races only
- [ ] `GET /api/campaign/expenditures` endpoint with candidate, office, cycle, payee, min/max_amount filters
- [ ] Frontend Campaign page adds an "Expenditures" tab alongside Contributions

## Notes
P2: Medium estimate — CSV format is known and the streaming pipeline exists; main work is schema design, filter logic, and new UI tab. First run may take several minutes depending on file size.
