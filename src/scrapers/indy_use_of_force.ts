// src/scrapers/indy_use_of_force.ts
// Indianapolis use of force reports from ArcGIS REST service.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const UOF_URL =
  'https://maps.indy.gov/arcgis/rest/services/IMPD/UseOfForce/FeatureServer/0/query';

export class IndyUseOfForceScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'use_of_force',
      city: 'indy',
      serviceUrl: UOF_URL,
      tableName: 'use_of_force',
      fieldMap: {
        report_id: 'REPORT_ID',
        incident_type: 'INCIDENT_TYPE',
        force_type: 'FORCE_TYPE',
        address: 'ADDRESS',
        district: 'DISTRICT',
        occurred_at: epochTimestampField('OCCURRED_DATE'),
        officer_years_experience: 'OFFICER_YEARS_EXP',
        subject_injury: 'SUBJECT_INJURY',
      },
      dedupFields: ['city', 'report_id'],
      orderByFields: 'OCCURRED_DATE DESC',
      whereClause: 'OCCURRED_DATE >= CURRENT_DATE - INTERVAL \'90 days\'',
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
