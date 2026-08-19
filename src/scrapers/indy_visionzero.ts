// src/scrapers/indy_visionzero.ts
// DPW VisionZero traffic crash data — 249K records from gis.indy.gov.
// Complements the existing IMPD crash data with pedestrian/bicycle counts,
// roadway class, manner of collision, and hit-and-run tracking.
import { ArcgisScraper, epochTimestampField } from './arcgis';

const VZ_URL =
  'https://gis.indy.gov/server/rest/services/DPW/DPW_VisionZero/FeatureServer/0/query';

export class IndyVisionZeroScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'visionzero',
      city: 'indy',
      serviceUrl: VZ_URL,
      tableName: 'visionzero_crashes',
      fieldMap: {
        crash_id: 'OBJECTID',
        vehicles: 'Vehicles',
        people_involved: 'PeopleInvolved',
        pedestrians: 'Pedestrians',
        bicycle: 'Bicycle',
        injuries: 'Injuries',
        fatalities: 'Fatalities',
        hit_and_run: 'HitandRun',
        roadway_class: 'RoadwayClass',
        manner_of_collision: 'MannerofCollision',
        crash_type: 'CrashType',
        severity: 'Severity',
        crash_status: 'CrashStatus',
        district: 'Geo_Districts',
        council_district: 'Geo_Council',
        occurred_at: epochTimestampField('CrashDate'),
        lat: 'Latitude',
        lng: 'Longitude',
      },
      dedupFields: ['city', 'crash_id'],
      orderByFields: 'CrashDate DESC',
      whereClause: "CrashDate >= CURRENT_DATE - INTERVAL '90' DAY",
      staticFields: { source: 'indy_visionzero' },
      enableAlerts: true,
    });
  }
}