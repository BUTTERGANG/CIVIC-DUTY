// src/scheduler.ts
import cron from 'node-cron';
import { pool } from './db';
import { CouncilScraper } from './scrapers/council';
import { BidsScraper } from './scrapers/bids';
import { ZoningScraper } from './scrapers/zoning';
import { CampaignScraper } from './scrapers/campaign';
import { IndyCouncilScraper } from './scrapers/indy_council';
import { IndyIncidentsScraper } from './scrapers/indy_incidents';
import { IndyCrashesScraper } from './scrapers/indy_crashes';
import { IndyCitationsScraper } from './scrapers/indy_citations';
import { IndyUseOfForceScraper } from './scrapers/indy_use_of_force';
import { IndyServiceRequestsScraper } from './scrapers/indy_service_requests';
import { IndyParcelsScraper } from './scrapers/indy_parcels';
import { HamCoParcelsScraper } from './scrapers/hamco_parcels';
import { HamCoBuildingsScraper } from './scrapers/hamco_buildings';
import { HamCoTaxDistrictsScraper } from './scrapers/hamco_tax_districts';
import { HamCoSchoolsScraper } from './scrapers/hamco_schools';
import { HamCoParksScraper } from './scrapers/hamco_parks';
import { HamCoPollingScraper } from './scrapers/hamco_polling';

async function logScrape(
  source: string,
  status: 'success' | 'error',
  recordsUpserted: number = 0,
  errorMessage?: string
) {
  try {
    await pool.query(
      `INSERT INTO scraper_log (source, status, records_upserted, error_message)
       VALUES ($1, $2, $3, $4)`,
      [source, status, recordsUpserted, errorMessage || null]
    );
  } catch (err: any) {
    console.error('[Scheduler] Failed to log scrape:', err.message);
  }
}

export function setupScheduler() {
  const fishersScrapers = {
    council:  new CouncilScraper(),
    bids:     new BidsScraper(),
    zoning:   new ZoningScraper(),
    campaign: new CampaignScraper(),
  };

  const indyScrapers = {
    council:         new IndyCouncilScraper(),
    incidents:       new IndyIncidentsScraper(),
    crashes:         new IndyCrashesScraper(),
    citations:       new IndyCitationsScraper(),
    useOfForce:      new IndyUseOfForceScraper(),
    serviceRequests: new IndyServiceRequestsScraper(),
    parcels:         new IndyParcelsScraper(),
  };

  const hamcoScrapers = {
    parcels:        new HamCoParcelsScraper(),
    buildings:      new HamCoBuildingsScraper(),
    taxDistricts:   new HamCoTaxDistrictsScraper(),
    schools:        new HamCoSchoolsScraper(),
    parks:          new HamCoParksScraper(),
    polling:        new HamCoPollingScraper(),
  };

  // Wrapper: run scraper, log result
  function scheduleWithLogging(
    cronExpr: string,
    source: string,
    run: () => Promise<{ recordsUpserted?: number } | undefined>
  ) {
    cron.schedule(cronExpr, async () => {
      console.log(`[Scheduler] Running ${source} scraper...`);
      try {
        const result = await run();
        const count = result?.recordsUpserted ?? 0;
        await logScrape(source, 'success', count);
        console.log(`[Scheduler] ${source} completed: ${count} records`);
      } catch (err: any) {
        await logScrape(source, 'error', 0, err.message);
        console.error(`[Scheduler] ${source} failed:`, err.message);
      }
    });
  }

  // Fishers schedule
  scheduleWithLogging('0 6 * * *', 'council',     () => fishersScrapers.council.run());
  scheduleWithLogging('0 7 * * *', 'bids',        () => fishersScrapers.bids.run());
  scheduleWithLogging('0 8 * * *', 'zoning',      () => fishersScrapers.zoning.run());
  scheduleWithLogging('0 9 * * 1', 'campaign',    () => fishersScrapers.campaign.run());

  // Indianapolis schedule
  scheduleWithLogging('0 10 * * *', 'indy_council',               () => indyScrapers.council.run());
  scheduleWithLogging('0 11 * * *', 'indy_incidents',             () => indyScrapers.incidents.run());
  scheduleWithLogging('0 12 * * *', 'indy_crashes',               () => indyScrapers.crashes.run());
  scheduleWithLogging('0 13 * * *', 'indy_citations',             () => indyScrapers.citations.run());
  scheduleWithLogging('0 14 * * *', 'indy_use_of_force',          () => indyScrapers.useOfForce.run());
  scheduleWithLogging('0 15 * * *', 'indy_service_requests',      () => indyScrapers.serviceRequests.run());
  scheduleWithLogging('0 2 * * 0',  'indy_parcels',               () => indyScrapers.parcels.run());

  // Hamilton County schedule
  scheduleWithLogging('0 3 * * 0', 'hamco_parcels',               () => hamcoScrapers.parcels.run());
  scheduleWithLogging('0 4 * * 0', 'hamco_buildings',             () => hamcoScrapers.buildings.run());
  scheduleWithLogging('0 5 * * 1', 'hamco_tax_districts',         () => hamcoScrapers.taxDistricts.run());
  scheduleWithLogging('0 5 * * 2', 'hamco_schools',               () => hamcoScrapers.schools.run());
  scheduleWithLogging('0 5 * * 3', 'hamco_parks',                 () => hamcoScrapers.parks.run());
  scheduleWithLogging('0 5 * * 4', 'hamco_polling',               () => hamcoScrapers.polling.run());

  console.log('[Scheduler] Cron jobs configured successfully.');
  console.log(`[Scheduler] Fishers: ${Object.keys(fishersScrapers).length} scrapers`);
  console.log(`[Scheduler] Indianapolis: ${Object.keys(indyScrapers).length} scrapers`);
  console.log(`[Scheduler] Hamilton County: ${Object.keys(hamcoScrapers).length} scrapers`);
}
