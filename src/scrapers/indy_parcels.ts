// src/scrapers/indy_parcels.ts
// Indianapolis property parcels from MapIndy ArcGIS REST service.
// NOTE: This is a large dataset (~400K records). The scraper processes in batches
// and is designed to run less frequently (weekly). First run may take 30-60 min.

import { ArcgisScraper, epochDateField } from './arcgis';

const PARCELS_URL =
  'https://maps.indy.gov/arcgis/rest/services/MapIndy/Parcels/FeatureServer/0/query';

export class IndyParcelsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'parcels',
      city: 'indy',
      serviceUrl: PARCELS_URL,
      tableName: 'parcels',
      fieldMap: {
        parcel_id: 'PARCEL_ID',
        address: 'SITE_ADDRESS',
        owner_name: 'OWNER_NAME',
        owner_address: 'OWNER_ADDRESS',
        land_use: 'LAND_USE',
        zoning: 'ZONING',
        assessed_value: 'ASSESSED_VALUE',
        land_area_sqft: 'LAND_AREA_SQFT',
        building_area_sqft: 'BLDG_AREA_SQFT',
        year_built: 'YEAR_BUILT',
        last_sale_date: epochDateField('LAST_SALE_DATE'),
        last_sale_price: 'LAST_SALE_PRICE',
      },
      dedupFields: ['city', 'parcel_id'],
      orderByFields: 'PARCEL_ID ASC',
      whereClause: '1=1',
      pageSize: 2000,
      pageDelayMs: 500,  // parcels service is typically fast
      staticFields: { source: 'mapindy' },
      enableAlerts: false,
    });
  }

  // Override run to add progress logging for large dataset
  async run(): Promise<void> {
    console.log('[IndyParcels] Starting — this is a large dataset (~400K records). First run may take 30-60 min.');
    const startTime = Date.now();
    await super.run();
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`[IndyParcels] Completed in ${elapsed} minutes`);
  }
}
