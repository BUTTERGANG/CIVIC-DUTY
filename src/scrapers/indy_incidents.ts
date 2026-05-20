// src/scrapers/indy_incidents.ts
// Indianapolis public safety incidents from ArcGIS REST service.
// Service: IMPD Incidents (or similar Indy open data portal)

import { ArcgisScraper, epochTimestampField } from './arcgis';

// Indy ArcGIS REST service for police incidents
// Note: URL may need adjustment based on exact Indy service catalog
const INCIDENTS_URL =
  'https://maps.indy.gov/arcgis/rest/services/IMPD/IMPD_Incidents/FeatureServer/0/query';

export class IndyIncidentsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'incidents',
      city: 'indy',
      serviceUrl: INCIDENTS_URL,
      tableName: 'incidents',
      fieldMap: {
        incident_id: 'INCIDENT_ID',
        incident_type: 'OFFENSE_TYPE',
        description: 'DESCRIPTION',
        address: 'BLOCK_ADDRESS',
        district: 'DISTRICT',
        occurred_at: epochTimestampField('OCCURRED_DATE'),
        // lat/lng auto-extracted from geometry
      },
      dedupFields: ['city', 'incident_id'],
      orderByFields: 'OCCURRED_DATE DESC',
      whereClause: 'OCCURRED_DATE >= CURRENT_DATE - INTERVAL \'90 days\'',
      staticFields: { source: 'indy_arcgis' },
      enableAlerts: false,  // too high volume for alerts
    });
  }
}
