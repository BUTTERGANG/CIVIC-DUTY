// src/scrapers/indy_use_of_force.ts
// Indianapolis use of force reports from ArcGIS REST service.
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).
// This source is a non-spatial ArcGIS Table (geometryType: None) with no lat/lng, and
// `Gen_Address` is a deliberately generalized address (not the exact incident location)
// — `hasGeometry: false` reflects that rather than leaving it to fail silently.
// There's no `incident_type` or `officer_years_experience` field in this source;
// `force_type` is derived from which of the taser/physical/K9/less-lethal/OC flags fired.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const UOF_URL =
  'https://gis.indy.gov/server/rest/services/IMPD/IMPD_UseOfForce_Public/FeatureServer/0/query';

export class IndyUseOfForceScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'use_of_force',
      city: 'indy',
      serviceUrl: UOF_URL,
      tableName: 'use_of_force',
      hasGeometry: false,
      fieldMap: {
        report_id: (attrs) => String(attrs.CaseNum).trim(),
        force_type: (attrs) => {
          const applied: string[] = [];
          if (attrs.taser && attrs.taser !== '0') applied.push('taser');
          if (attrs.Physical && attrs.Physical !== '0') applied.push('physical');
          if (attrs.K9b && attrs.K9b !== '0') applied.push('k9');
          if (attrs.LessLethal && attrs.LessLethal !== '0') applied.push('less_lethal');
          if (attrs.oc && attrs.oc !== '0') applied.push('oc_spray');
          return applied.length ? applied.join(', ') : null;
        },
        address: 'Gen_Address',
        district: 'Geo_Districts',
        occurred_at: epochTimestampField('OccDate'),
        subject_injury: 'Sub_Injured',
      },
      extraOutFields: ['CaseNum', 'taser', 'Physical', 'K9b', 'LessLethal', 'oc'],
      dedupFields: ['city', 'report_id'],
      orderByFields: 'OccDate DESC',
      whereClause: "OccDate >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
