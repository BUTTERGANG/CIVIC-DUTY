// src/scrapers/indy_zoning_variances.ts
// Zoning variance applications from Accela XAPO — 24K records with point geometry.
// Case numbers, recommendations, status, decision dates, and planner assignments.
import { ArcgisScraper } from './arcgis';

const ZV_URL =
  'https://gis.indy.gov/server/rest/services/Accela/ACCELA_XAPO_ADDRESS/MapServer/2/query';

export class IndyZoningVarianceScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'zoning_variances',
      city: 'indy',
      serviceUrl: ZV_URL,
      tableName: 'zoning_variances',
      fieldMap: {
        case_number: 'CASE_NUM',
        recommendation: 'RECOMMENDATION',
        status: 'STATUS',
        decision_date: 'DECISION_DATE',
        planner: 'PLANNER',
      },
      dedupFields: ['city', 'case_number'],
      orderByFields: 'DECISION_DATE DESC',
      whereClause: '1=1',
      staticFields: { source: 'indy_accela' },
      enableAlerts: false,
    });
  }
}