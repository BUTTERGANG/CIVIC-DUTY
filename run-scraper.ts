// Manual scraper runner — usage: npx ts-node run-scraper.ts [scraper-name]
import { CouncilScraper } from './src/scrapers/council';
import { BidsScraper } from './src/scrapers/bids';
import { CampaignScraper } from './src/scrapers/campaign';
import { ZoningScraper } from './src/scrapers/zoning';
import { HamCoParcelsScraper } from './src/scrapers/hamco_parcels';
import { HamCoBuildingsScraper } from './src/scrapers/hamco_buildings';
import { HamCoTaxDistrictsScraper } from './src/scrapers/hamco_tax_districts';
import { HamCoSchoolsScraper } from './src/scrapers/hamco_schools';
import { HamCoParksScraper } from './src/scrapers/hamco_parks';
import { HamCoPollingScraper } from './src/scrapers/hamco_polling';

const target = process.argv[2] ?? 'council';

const scrapers: Record<string, { run(): Promise<void> }> = {
  council:          new CouncilScraper(),
  bids:             new BidsScraper(),
  campaign:         new CampaignScraper(),
  zoning:           new ZoningScraper(),
  hamco_parcels:    new HamCoParcelsScraper(),
  hamco_buildings:  new HamCoBuildingsScraper(),
  hamco_tax:        new HamCoTaxDistrictsScraper(),
  hamco_schools:    new HamCoSchoolsScraper(),
  hamco_parks:      new HamCoParksScraper(),
  hamco_polling:    new HamCoPollingScraper(),
};

const scraper = scrapers[target];
if (!scraper) {
  console.error(`Unknown scraper "${target}". Available: ${Object.keys(scrapers).join(', ')}`);
  process.exit(1);
}

scraper.run()
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
