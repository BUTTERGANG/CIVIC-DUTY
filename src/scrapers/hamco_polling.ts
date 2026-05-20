// src/scrapers/hamco_polling.ts
// Hamilton County polling locations from county GIS.

import { ArcgisScraper } from './arcgis';

const VOTING_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoVoting/FeatureServer/0/query';

export class HamCoPollingScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'polling_locations',
      city: 'hamco',
      serviceUrl: VOTING_URL,
      tableName: 'polling_locations',
      fieldMap: {
        name:       'Polling_Site_Name',
        address:    'Polling_Site_Add_Line_1',
        city_name:  'Polling_Site_City',
        precincts:  'Precincts',
      },
      dedupFields: ['city', 'name', 'address'],
      whereClause: '1=1',
      orderByFields: 'Polling_Site_Name ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'hamco_gis' },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoPolling] Starting — Hamilton County polling locations.');
    await super.run();
  }
}
