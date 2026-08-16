---
title: "Council Vote Keyword Search"
status: done
priority: P1
project: civic-duty
type: dev
agent_claimed: agent-03
claimed_at: null
created: '2026-06-08T00:00:00Z'
updated: '2026-06-08T12:00:00Z'
tags: []
due: null
estimate: small
---

# Council Vote Keyword Search

## Summary
Add keyword search to the council votes API and UI so users can find relevant agenda items and vote records without knowing the exact date or tag.

## Value Proposition
`GET /api/council` currently supports `from`, `to`, `tags`, `limit`, `offset` — but no free-text search. A user who wants to find everything about "Saxony Road roundabout" or "tax levy" has no way to do it. Keyword search is the most basic discovery feature and directly unlocks the alert system's value.

## Context
- Council route: `src/routes/council.ts` — add `?q=<keyword>` parameter
- Database: `council_votes` table has `title`, `summary` (text) and `agenda_items` (JSONB)
- Use PostgreSQL `ILIKE` for quick implementation; optionally add `tsvector` index for performance
- Frontend: `CIVIC-DUTY-UI/src/pages/Council.tsx` — wire the existing search bar input to `?q=`
- Search should cover: `title`, `summary`, and text content within `agenda_items` JSONB array

## Acceptance Criteria
- [ ] `GET /api/council?q=<keyword>` added; searches `title`, `summary`, and `agenda_items` text
- [ ] Case-insensitive match using `ILIKE '%keyword%'` on text columns and JSONB cast
- [ ] Frontend Council page search bar fires query on input with 300ms debounce
- [ ] Empty `?q=` returns all results (existing behavior preserved)

## Notes
P1: Tiny implementation surface, high immediate value. Small estimate — backend param + ILIKE query + frontend debounce wiring.
