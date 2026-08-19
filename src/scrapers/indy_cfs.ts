// src/scrapers/indy_cfs.ts
// IMPD Calls for Service (CAD) — 5.1M records from gis.indy.gov.
// Every police dispatch call with lat/lng, response timelines, and council district.
// This is the richest public-safety dataset available for Indianapolis.
import { ArcgisScraper, epochTimestampField } from './arcgis';

const CFS_URL =
  'https://gis.indy.gov/server/rest/services/IMPD/IMPD_Public_Data/FeatureServer/0/query';

export class IndyCfsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'cfs',
      city: 'indy',
      serviceUrl: CFS_URL,
      tableName: 'calls_for_service',
      fieldMap: {
        cad: 'CAD',
        call_source: 'CallSource',
        incident_type: 'IncidentType',
        primary_dispatch: 'PrimaryDisp',
        address: 'sAddress',
        district: 'Geo_Districts',
        council_district: 'Geo_Council',
        received_at: epochTimestampField('RecDateTime'),
        dispatched_at: epochTimestampField('DspDateTime'),
        arrived_at: epochTimestampField('ArrDateTime'),
        cleared_at: epochTimestampField('CmplDateTime'),
        lat: 'Latitude',
        lng: 'Longitude',
      },
      dedupFields: ['city', 'cad'],
      orderByFields: 'RecDateTime DESC',
      whereClause: "RecDateTime >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_cfs' },
      enableAlerts: true,
    });
  }
}