// src/scrapers/indy_parcels.ts
// Indianapolis property parcels from MapIndy ArcGIS REST service.
// NOTE: This is a large dataset (~400K records). The scraper processes in batches
// and is designed to run less frequently (weekly). First run may take 30-60 min.
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).
// This layer is a Polygon layer (parcel boundaries), not points, so lat/lng come from
// the ArcGIS `returnCentroid` param (see arcgis.ts) rather than raw geometry x/y.
// This service is assessment data only — it has no zoning, year-built, or sale-history
// fields, so `zoning`, `year_built`, `last_sale_date`, `last_sale_price`, and
// `building_area_sqft` are left unmapped (stay null) rather than guessed.

import { ArcgisScraper } from './arcgis';

const PARCELS_URL =
  'https://gis.indy.gov/server/rest/services/MapIndy/MapIndyProperty/MapServer/10/query';

export class IndyParcelsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'parcels',
      city: 'indy',
      serviceUrl: PARCELS_URL,
      tableName: 'parcels',
      fieldMap: {
        parcel_id: 'STATEPARCELNUMBER',
        address: (attrs) =>
          [attrs.STNUMBER, attrs.PRE_DIR, attrs.STREET_NAME, attrs.SUFFIX, attrs.SUF_DIR]
            .filter(Boolean)
            .join(' '),
        owner_name: 'FULLOWNERNAME',
        owner_address: (attrs) =>
          [attrs.OWNERADDRESS, attrs.OWNERCITY, attrs.OWNERSTATE, attrs.OWNERZIP]
            .filter(Boolean)
            .join(', '),
        land_use: 'PROPERTY_CLASS',
        assessed_value: 'ASSESSORYEAR_TOTALAV',
        land_area_sqft: 'ESTSQFT',
      },
      extraOutFields: ['STNUMBER', 'PRE_DIR', 'STREET_NAME', 'SUFFIX', 'SUF_DIR', 'OWNERADDRESS', 'OWNERCITY', 'OWNERSTATE', 'OWNERZIP'],
      useCentroid: true,
      dedupFields: ['city', 'parcel_id'],
      orderByFields: 'STATEPARCELNUMBER ASC',
      whereClause: '1=1',
      pageSize: 2000,
      pageDelayMs: 500, // parcels service is typically fast
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
