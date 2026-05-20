// src/scrapers/hamco_parcels.ts
// Hamilton County parcel data from county GIS.
// Covers all incorporated areas: Fishers, Carmel, Noblesville, Arcadia, Atlanta, Cicero, Sheridan, Westfield, and unincorporated areas.
// The county parcels layer has a CORPLIMIT field that identifies the municipality — we use this as the `city` value.

import { ArcgisScraper, epochDateField } from './arcgis';

const PARCELS_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoParcelsPublic/FeatureServer/0/query';

export class HamCoParcelsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'parcels',
      city: 'hamco',           // overridden per-row by CORPLIMIT transform
      serviceUrl: PARCELS_URL,
      tableName: 'parcels',
      fieldMap: {
        parcel_id:      'PARCELNO',
        address:        'LOCADDRESS',
        owner_name:     'OWNNAME',
        owner_address:  (attrs) => [attrs.OWNADDRESS, attrs.OWNCITY, attrs.OWNSTATE, attrs.OWNZIP].filter(Boolean).join(', '),
        land_use:       'PROPUSE',
        zoning:         'PROPCLASS',
        tax_district:   'TAXDISTNAM',
        assessed_value: (attrs) => attrs.AVTOTGROSS ?? null,
        land_area_sqft: (attrs) => {
          // DEEDEDACRES is in acres, convert to sq ft
          const acres = attrs.DEEDACRES;
          return acres ? Math.round(acres * 43560) : null;
        },
        year_built:     'year_built',
        last_sale_date: epochDateField('LSTXFRDATE'),
      },
      dedupFields: ['parcel_id'],
      whereClause: '1=1',
      orderByFields: 'PARCELNO ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,     // parcels are reference data, no alerts needed
      staticFields: { source: 'hamco_gis' },
      transform: (row, attrs) => {
        // Map CORPLIMIT (municipality name) to city slug
        const corpLimit = (attrs.CORPLIMIT || '').toLowerCase();
        let city = 'unincorporated';
        if (corpLimit.includes('fishers')) city = 'fishers';
        else if (corpLimit.includes('carmel')) city = 'carmel';
        else if (corpLimit.includes('noblesville')) city = 'noblesville';
        else if (corpLimit.includes('westfield')) city = 'westfield';
        else if (corpLimit.includes('sheridan')) city = 'sheridan';
        else if (corpLimit.includes('arcadia')) city = 'arcadia';
        else if (corpLimit.includes('atlanta')) city = 'atlanta';
        else if (corpLimit.includes('cicero')) city = 'cicero';
        else city = corpLimit.replace(/\s+/g, '_') || 'unincorporated';

        return { ...row, city };
      },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoParcels] Starting — Hamilton County parcels (all municipalities).');
    console.log('[HamCoParcels] This is a large dataset. First run may take 30-60 min.');
    const startTime = Date.now();
    await super.run();
    const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
    console.log(`[HamCoParcels] Completed in ${elapsed} minutes`);
  }
}
