---
title: "Email Alert Delivery"
status: backlog
priority: P1
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

# Email Alert Delivery

## Summary
Wire the existing alert engine to send email notifications when a watchlist rule fires, so users get notified even when they don't have the app open.

## Value Proposition
`src/alerts/engine.ts` already matches keyword and geo rules against every new scraper insert and writes to the `alerts` table — but notifications are purely in-app. Users with high-value watchlists (zoning near their property, procurement bids in their industry) need push-to-inbox delivery to act on time-sensitive civic events.

## Context
- Alert engine: `src/alerts/engine.ts` (keyword + geo rule matching)
- Alert rules: `src/routes/alerts.ts` — GET/POST/DELETE `/api/alerts/rules`
- Database: `alert_rules` table has `user_id`; `users` table has `email`
- Add: SendGrid (`@sendgrid/mail`) or Nodemailer + SMTP transport
- New env vars: `EMAIL_FROM`, `SENDGRID_API_KEY` (or `SMTP_HOST/PORT/USER/PASS`)
- Email template: module name, matched keyword, item title, direct link

## Acceptance Criteria
- [ ] New triggered alert sends an email to the rule's user within 60 seconds of engine fire
- [ ] Email contains: module badge, matched keyword, item title, and a direct link to the item
- [ ] Users can toggle email delivery per rule via a checkbox in the Alerts UI
- [ ] `email_enabled` boolean column added to `alert_rules` table (default true)
- [ ] `EMAIL_FROM` and `SENDGRID_API_KEY` added to `.env.example` with comments

## Notes
P1: The alert system's value is severely limited without out-of-app delivery. Medium estimate — engine hook is trivial; most work is email template + rule UI toggle + env wiring.
