// src/scrapers/indy_crashes.ts
// Indianapolis traffic crashes from ArcGIS REST service.
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).
// The source has no direct "severity" field — derived from Injuries/Fatalities counts.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const CRASHES_URL =
  'https://gis.indy.gov/server/rest/services/IMPD/IMPD_Crash_Public/FeatureServer/0/query';

export class IndyCrashesScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'crashes',
      city: 'indy',
      serviceUrl: CRASHES_URL,
      tableName: 'crashes',
      fieldMap: {
        crash_id: 'CrashNum',
        crash_type: 'MannerofCollision',
        severity: (attrs) =>
          attrs.Fatalities > 0 ? 'fatal' : attrs.Injuries > 0 ? 'injury' : 'property_damage',
        address: 'sAddress',
        district: 'Geo_Districts',
        occurred_at: epochTimestampField('CrashDate'),
        vehicles_involved: 'Vehicles',
        injuries: 'Injuries',
        fatalities: 'Fatalities',
      },
      dedupFields: ['city', 'crash_id'],
      orderByFields: 'CrashDate DESC',
      whereClause: "CrashDate >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
