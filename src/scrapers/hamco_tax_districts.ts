// src/scrapers/hamco_tax_districts.ts
// Hamilton County tax districts from county GIS.

import { ArcgisScraper } from './arcgis';

const TAX_DISTRICTS_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoTaxDistricts/FeatureServer/0/query';

export class HamCoTaxDistrictsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'tax_districts',
      city: 'hamco',
      serviceUrl: TAX_DISTRICTS_URL,
      tableName: 'tax_districts',
      fieldMap: {
        district_code: 'TAXDISTCOD',
        district_name: 'TAXDISTNAM',
      },
      dedupFields: ['city', 'district_code'],
      whereClause: '1=1',
      orderByFields: 'TAXDISTCOD ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'hamco_gis', district_type: 'tax' },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoTaxDistricts] Starting — Hamilton County tax districts.');
    await super.run();
  }
}
