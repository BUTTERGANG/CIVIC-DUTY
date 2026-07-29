{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    # Playwright drives this instead of downloading its own browser.
    # Needed by the Fishers/IDOA bids scrapers and the MyCase court lookup;
    # every other scraper is plain HTTP and works without it.
    pkgs.chromium
    # psql, for running src/db/schema.sql against the database.
    pkgs.postgresql_16
  ];
}
