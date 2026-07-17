// src/scrapers/indy_citations.ts
// Indianapolis police citations from ArcGIS REST service.
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).
// `citation_id` maps to OBJECTID, not CitationNumber: a single citation can list
// multiple violations, each as its own row sharing one CitationNumber, so
// CitationNumber alone is not unique.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const CITATIONS_URL =
  'https://gis.indy.gov/server/rest/services/IMPD/IMPD_Citations_Public/FeatureServer/0/query';

export class IndyCitationsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'citations',
      city: 'indy',
      serviceUrl: CITATIONS_URL,
      tableName: 'citations',
      fieldMap: {
        citation_id: 'OBJECTID',
        violation: 'Violation_Desc',
        violation_type: 'OffenseType',
        address: 'sAddress',
        district: 'Geo_Districts',
        issued_at: epochTimestampField('Citationdatetime'),
        driver_age: 'Age',
        driver_sex: 'Sex',
        driver_race: 'Race',
      },
      dedupFields: ['city', 'citation_id'],
      orderByFields: 'Citationdatetime DESC',
      whereClause: "Citationdatetime >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
