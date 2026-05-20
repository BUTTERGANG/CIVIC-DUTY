// src/scrapers/hamco_parks.ts
// Hamilton County parks, trails, and park features from county GIS.
// The HamCoParks service has multiple layers: Park Boundaries (polygon), Trails (polyline),
// Trailheads (point), Park Memorials (point), Park Rules Signs (point).
// We scrape Park Boundaries (layer 4) as the primary park layer.

import { ArcgisScraper } from './arcgis';

const PARK_BOUNDARIES_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoParks/MapServer/4/query';

export class HamCoParksScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'parks',
      city: 'hamco',
      serviceUrl: PARK_BOUNDARIES_URL,
      tableName: 'parks',
      fieldMap: {
        name:       'Name',
        park_type:  () => 'boundary',
        address:    'Address',
        description: 'Description',
      },
      dedupFields: [],         // no reliable unique key — insert-only for parks
      whereClause: '1=1',
      orderByFields: 'Name ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'hamco_gis' },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoParks] Starting — Hamilton County park boundaries.');
    await super.run();
  }
}
