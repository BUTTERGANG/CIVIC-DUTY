// src/scrapers/indy_service_requests.ts
// Indianapolis 311 service requests from RequestIndy ArcGIS REST service.

import { ArcgisScraper, epochTimestampField } from './arcgis';

const SERVICE_REQUESTS_URL =
  'https://maps.indy.gov/arcgis/rest/services/RequestIndy/RequestIndy_311/FeatureServer/0/query';

export class IndyServiceRequestsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'service_requests',
      city: 'indy',
      serviceUrl: SERVICE_REQUESTS_URL,
      tableName: 'service_requests',
      fieldMap: {
        request_id: 'SERVICE_REQUEST_ID',
        request_type: 'REQUEST_TYPE',
        description: 'DESCRIPTION',
        status: 'STATUS',
        address: 'ADDRESS',
        district: 'DISTRICT',
        requested_at: epochTimestampField('REQUEST_DATE'),
        closed_at: epochTimestampField('CLOSED_DATE'),
      },
      dedupFields: ['city', 'request_id'],
      orderByFields: 'REQUEST_DATE DESC',
      whereClause: 'REQUEST_DATE >= CURRENT_DATE - INTERVAL \'180 days\'',
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,
    });
  }
}
