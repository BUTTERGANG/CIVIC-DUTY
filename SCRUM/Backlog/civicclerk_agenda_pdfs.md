---
title: "CivicClerk Per-Agenda-Item PDFs"
status: backlog
priority: P3
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

# CivicClerk Per-Agenda-Item PDFs

## Summary
Extend the CivicClerk scraper to download and extract text from the per-agenda-item PDFs (resolutions, ordinances) attached to each meeting event, making the full text of local legislation searchable.

## Value Proposition
Documented in `TODO.md`. Minutes and agenda-level PDFs are already processed by `src/scrapers/pdf.ts`. But the resolutions and ordinances attached to individual agenda items contain the actual legislative text — what council members voted on. Extracting this text makes keyword search (and alert matching) far more precise than agenda titles alone.

## Context
- Documented: `TODO.md` — "CivicClerk per-agenda-item PDFs"
- Existing: `src/scrapers/pdf.ts` handles minutes + agendas via HTTPS + pdf-parse
- Problem: per-item PDFs sit behind time-limited Azure Blob SAS URLs in the event detail DOM — requires Playwright to extract the URL before it expires
- Strategy: during council event scrape, open event detail page in Playwright, extract SAS URLs, download immediately (before expiry), extract text with pdf-parse
- Storage: extend `agenda_items` JSONB column with `{ pdf_text: string }` per item

## Acceptance Criteria
- [ ] During CivicClerk event scrape, Playwright extracts per-agenda-item PDF SAS URLs from the event detail DOM
- [ ] PDFs downloaded immediately and text extracted via pdf-parse (same approach as `pdf.ts`)
- [ ] Extracted text stored in `agenda_items` JSONB: `{ title, pdf_url, pdf_text }`
- [ ] Council detail view in the frontend renders "View Document" link and shows extracted text excerpt
- [ ] Keyword search (`?q=`) searches `pdf_text` content in addition to title and summary

## Notes
P3: Medium estimate. Main risk is SAS URL expiry window — must download within the Playwright session. Rate limiting may apply; add 500ms delay between PDF downloads per event.
