// src/scrapers/hamco_schools.ts
// Hamilton County schools from county GIS.

import { ArcgisScraper, epochDateField } from './arcgis';

const SCHOOLS_URL =
  'https://gis1.hamiltoncounty.in.gov/arcgis/rest/services/HamCoSchools/FeatureServer/0/query';

export class HamCoSchoolsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'schools',
      city: 'hamco',
      serviceUrl: SCHOOLS_URL,
      tableName: 'schools',
      fieldMap: {
        name:        'SCHOOL_NAM',
        district:    'DISTRICT',
        district_num: 'DIST_NUM',
        address:     'ADDRESS',
        zip:         'ZIP5',
        phone:       'PHONE_NUMB',
        website:     'WWW',
        opened:      'OPENED',
        status:      'Status',
      },
      dedupFields: ['city', 'name', 'address'],
      whereClause: '1=1',
      orderByFields: 'SCHOOL_NAM ASC',
      pageSize: 2000,
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'hamco_gis' },
      transform: (row, attrs) => {
        // Derive school type from name
        const name = (row.name || '').toLowerCase();
        let school_type = 'other';
        if (name.includes('elementary')) school_type = 'elementary';
        else if (name.includes('middle')) school_type = 'middle';
        else if (name.includes('high') || name.includes('senior')) school_type = 'high';
        else if (name.includes('intermediate')) school_type = 'intermediate';
        else if (name.includes('primary')) school_type = 'primary';
        else if (name.includes('academy')) school_type = 'academy';
        else if (name.includes('charter')) school_type = 'charter';
        return { ...row, school_type };
      },
    });
  }

  async run(): Promise<void> {
    console.log('[HamCoSchools] Starting — Hamilton County schools.');
    await super.run();
  }
}
