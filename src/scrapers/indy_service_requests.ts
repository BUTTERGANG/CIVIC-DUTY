// src/scrapers/indy_service_requests.ts
// Indianapolis 311 service requests, from the Mayor's Action Center's
// RequestIndy feed (branded "RequestIndy" in the product, "RIMAC" in the
// underlying open-data service name).
//
// URL/field map verified live 2026-07-17 against gis.indy.gov (the previous
// maps.indy.gov URL 404'd — see git history / SCRUM/06_Programs/civic-duty/context.md).

import { ArcgisScraper, epochTimestampField } from './arcgis';

const SERVICE_REQUESTS_URL =
  'https://gis.indy.gov/server/rest/services/OpenData/ODP_RIMACServiceRequests/FeatureServer/0/query';

export class IndyServiceRequestsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'service_requests',
      city: 'indy',
      serviceUrl: SERVICE_REQUESTS_URL,
      tableName: 'service_requests',
      fieldMap: {
        request_id: 'SERVICEREQUESTID',
        request_type: 'SERVICENAME',
        description: 'ACTIVITY',
        status: 'STATUS',
        address: 'ADDRESS',
        district: 'COUNCILDISTRICT',
        requested_at: epochTimestampField('REQUESTEDDATETIME'),
        closed_at: epochTimestampField('CLOSEDDATETIME'),
      },
      dedupFields: ['city', 'request_id'],
      orderByFields: 'REQUESTEDDATETIME DESC',
      whereClause: "REQUESTEDDATETIME >= CURRENT_DATE - INTERVAL '180' DAY",
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
