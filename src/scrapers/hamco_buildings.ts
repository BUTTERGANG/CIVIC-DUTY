// src/scrapers/hamco_buildings.ts
// Hamilton County building footprints from county GIS.
// NOTE: This layer has NO municipality field — buildings are county-wide.
// We assign city via spatial join with corporate limits in post-processing.
// For now, city is set to 'hamco' and refined later.

import { ArcgisScraper } from './arcgis';

const BUILDINGS_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoBuildingFootprints/FeatureServer/0/query';

export class HamCoBuildingsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'buildings',
      city: 'hamco',
      serviceUrl: BUILDINGS_URL,
      tableName: 'buildings',
      fieldMap: {
        building_id:     'OBJECTID',
        area_sqft:       'DBO.HAMCO_Buildings2025.area',
        status:          'Status',
        year_built:      'FID2024',  // best available proxy
      },
      dedupFields: ['building_id'],
      whereClause: '1=1',
      orderByFields: 'OBJECTID ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'hamco_gis' },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoBuildings] Starting — Hamilton County building footprints.');
    const startTime = Date.now();
    await super.run();
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`[HamCoBuildings] Completed in ${elapsed} minutes`);
  }
}
