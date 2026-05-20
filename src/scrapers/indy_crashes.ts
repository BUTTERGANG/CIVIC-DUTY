// src/scrapers/indy_crashes.ts
// Indianapolis traffic crashes from ArcGIS REST service.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const CRASHES_URL =
  'https://maps.indy.gov/arcgis/rest/services/IMPD/Traffic_Crashes/FeatureServer/0/query';

export class IndyCrashesScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'crashes',
      city: 'indy',
      serviceUrl: CRASHES_URL,
      tableName: 'crashes',
      fieldMap: {
        crash_id: 'CRASH_ID',
        crash_type: 'COLLISION_TYPE',
        severity: 'SEVERITY',
        address: 'STREET_ADDRESS',
        district: 'DISTRICT',
        occurred_at: epochTimestampField('CRASH_DATE'),
        vehicles_involved: 'VEHICLES_INVOLVED',
        injuries: 'INJURIES',
        fatalities: 'FATALITIES',
      },
      dedupFields: ['city', 'crash_id'],
      orderByFields: 'CRASH_DATE DESC',
      whereClause: 'CRASH_DATE >= CURRENT_DATE - INTERVAL \'90 days\'',
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
