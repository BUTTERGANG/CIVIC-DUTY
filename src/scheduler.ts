// src/scheduler.ts
import cron from 'node-cron';
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

export function setupScheduler() {
  // Fishers scrapers
  const fishersScrapers = {
    council:  new CouncilScraper(),
    bids:     new BidsScraper(),
    zoning:   new ZoningScraper(),
    campaign: new CampaignScraper(),
  };

  // Indianapolis scrapers
  const indyScrapers = {
    council:         new IndyCouncilScraper(),
    incidents:       new IndyIncidentsScraper(),
    crashes:         new IndyCrashesScraper(),
    citations:       new IndyCitationsScraper(),
    useOfForce:      new IndyUseOfForceScraper(),
    serviceRequests: new IndyServiceRequestsScraper(),
    parcels:         new IndyParcelsScraper(),
  };

  // Fishers schedule
  cron.schedule('0 6 * * *',   () => fishersScrapers.council.run());   // daily 6am
  cron.schedule('0 7 * * *',   () => fishersScrapers.bids.run());      // daily 7am
  cron.schedule('0 8 * * *',   () => fishersScrapers.zoning.run());    // daily 8am
  cron.schedule('0 9 * * 1',   () => fishersScrapers.campaign.run());  // mondays 9am

  // Hamilton County scrapers (covers Fishers, Carmel, Noblesville, Westfield, etc.)
  const hamcoScrapers = {
    parcels:        new HamCoParcelsScraper(),
    buildings:      new HamCoBuildingsScraper(),
    taxDistricts:   new HamCoTaxDistrictsScraper(),
    schools:        new HamCoSchoolsScraper(),
    parks:          new HamCoParksScraper(),
    polling:        new HamCoPollingScraper(),
  };

  // Indianapolis schedule (staggered to avoid overloading)
  cron.schedule('0 10 * * *',  () => indyScrapers.council.run());         // daily 10am
  cron.schedule('0 11 * * *',  () => indyScrapers.incidents.run());       // daily 11am
  cron.schedule('0 12 * * *',  () => indyScrapers.crashes.run());         // daily 12pm
  cron.schedule('0 13 * * *',  () => indyScrapers.citations.run());       // daily 1pm
  cron.schedule('0 14 * * *',  () => indyScrapers.useOfForce.run());      // daily 2pm
  cron.schedule('0 15 * * *',  () => indyScrapers.serviceRequests.run()); // daily 3pm
  cron.schedule('0 2 * * 0',   () => indyScrapers.parcels.run());         // Sundays 2am (large dataset)

  // Hamilton County schedule (weekly, staggered — large datasets)
  cron.schedule('0 3 * * 0',   () => hamcoScrapers.parcels.run());         // Sundays 3am (largest dataset)
  cron.schedule('0 4 * * 0',   () => hamcoScrapers.buildings.run());       // Sundays 4am
  cron.schedule('0 5 * * 1',   () => hamcoScrapers.taxDistricts.run());    // Mondays 5am
  cron.schedule('0 5 * * 2',   () => hamcoScrapers.schools.run());         // Tuesdays 5am
  cron.schedule('0 5 * * 3',   () => hamcoScrapers.parks.run());           // Wednesdays 5am
  cron.schedule('0 5 * * 4',   () => hamcoScrapers.polling.run());         // Thursdays 5am

  console.log('[Scheduler] Cron jobs configured successfully.');
  console.log(`[Scheduler] Fishers: ${Object.keys(fishersScrapers).length} scrapers`);
  console.log(`[Scheduler] Indianapolis: ${Object.keys(indyScrapers).length} scrapers`);
  console.log(`[Scheduler] Hamilton County: ${Object.keys(hamcoScrapers).length} scrapers`);
}
