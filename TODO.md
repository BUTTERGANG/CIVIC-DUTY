# Future Work & Open Questions

This file tracks potential future work, open questions, and ideas for improving the CivicDuty project. It's a living document that should be updated as new ideas arise. When a decision is made to actively pursue one of these items, it should be moved to the project's issue tracker.

## FCPA expenditure ingestion
The expenditure CSV from the Indiana FCPA site has an `OfficeSought` field (e.g. "Fishers City Council") which would enable Fishers-specific filtering. This would require adding a new table for expenditures or extending the existing `campaign_contributions` table to accommodate these new rows.

## Fishers bids archive
The current bids page on the Fishers city website only shows active listings. It would be valuable to investigate whether an archive of closed or awarded bids exists. This would provide a more complete historical record of procurement.

## CivicClerk per-agenda-item PDFs
The resolutions and ordinances associated with agenda items are available as PDFs, but they are located at time-limited Azure Blob SAS URLs within the event detail DOM. A possible improvement would be to investigate whether a hidden API exposes these files in a more stable way, avoiding the need for Playwright.

## MyCase party-name search
The current on-demand lookup in MyCase requires an exact case number. Extending this to support searching by party name would make the feature much more powerful. This would likely involve using `POST /mycase/Search/SearchCases` with `Mode: "ByParty"`.
