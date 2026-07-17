// src/scrapers/indy_incidents.ts
// Indianapolis public safety incidents, sourced from IMPD's public NIBRS
// (National Incident-Based Reporting System) feed.
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).
// This source is a non-spatial ArcGIS Table (geometryType: None) — IMPD does not
// publish exact incident location publicly, only city/zip. There is no `address` or
// lat/lng for this dataset (same privacy pattern as indy_use_of_force.ts's generalized
// address); `hasGeometry: false` reflects that rather than leaving it to fail silently.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const INCIDENTS_URL =
  'https://gis.indy.gov/server/rest/services/IMPD/IMPD_NIBRS_Public/FeatureServer/1/query';

export class IndyIncidentsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'incidents',
      city: 'indy',
      serviceUrl: INCIDENTS_URL,
      tableName: 'incidents',
      hasGeometry: false,
      fieldMap: {
        incident_id: 'CaseNum',
        incident_type: 'NIBRSClassDesc',
        description: 'CR_Desc',
        district: 'Geo_Districts',
        occurred_at: epochTimestampField('OccurredFrom'),
      },
      dedupFields: ['city', 'incident_id'],
      orderByFields: 'OccurredFrom DESC',
      whereClause: "OccurredFrom >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false, // too high volume for alerts
    });
  }
}
