// src/scrapers/indy_citations.ts
// Indianapolis police citations from ArcGIS REST service.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const CITATIONS_URL =
  'https://maps.indy.gov/arcgis/rest/services/IMPD/Citations/FeatureServer/0/query';

export class IndyCitationsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'citations',
      city: 'indy',
      serviceUrl: CITATIONS_URL,
      tableName: 'citations',
      fieldMap: {
        citation_id: 'CITATION_ID',
        violation: 'VIOLATION',
        violation_type: 'VIOLATION_TYPE',
        address: 'ADDRESS',
        district: 'DISTRICT',
        issued_at: epochTimestampField('ISSUED_DATE'),
        driver_age: 'DRIVER_AGE',
        driver_sex: 'DRIVER_SEX',
        driver_race: 'DRIVER_RACE',
      },
      dedupFields: ['city', 'citation_id'],
      orderByFields: 'ISSUED_DATE DESC',
      whereClause: 'ISSUED_DATE >= CURRENT_DATE - INTERVAL \'90 days\'',
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
