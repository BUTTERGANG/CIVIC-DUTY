// src/scrapers/illinois_mines.ts
// Illinois mining data from the IL DNR ArcGIS server (maps.dnr.illinois.gov).
// MinesPublic service layers:
//   0  Permits                    — mine permit boundaries (polygon, ~1.1K)
//   12 ISGS Mine Shaft Locations  — documented shafts (point, ~7.4K)
//   13 Aggregate Mines            — sand/gravel/pit operations (point, ~240)
// Each layer is a separate ArcgisScraper config writing to its own table.

import { ArcgisScraper, epochDateField } from './arcgis';

const MINES_PUBLIC_BASE =
  'https://maps.dnr.illinois.gov/geoservices/rest/services/MinesPublic/MapServer';

export class IllinoisMinePermitsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'il_mine_permits',
      city: 'illinois',
      serviceUrl: `${MINES_PUBLIC_BASE}/0/query`,
      tableName: 'illinois_mine_permits',
      fieldMap: {
        permit_id:    'PERMIT_ID',
        national_id:  'NATIONAL_ID',
        permittee:    'PERMITTEE',
        mine_name:    'MINE',
        unit_name:    'PIT_PORTAL_NAME',
        unit_no:      'UNIT',
        acres:        'ACRES',
        date_issued:  epochDateField('DATE_ISSUED'),
        status_date:  epochDateField('StatusDate'),
        permit_type:  'PERMIT_TYPE',
        status:       'PERMIT_STATUS',
        contact:      'CONTACT',
      },
      dedupFields: ['national_id', 'permit_id', 'unit_no'],
      orderByFields: 'OBJECTID ASC',
      pageSize: 1000,              // this server caps maxRecordCount at 1000
      pageDelayMs: 500,
      enableAlerts: false,
      useCentroid: true,           // polygon layer — need a representative point
      staticFields: { source: 'il_dnr_gis' },
      // Keep both dedup keys non-null so the ON CONFLICT target always matches
      // the UNIQUE(national_id, permit_id) constraint.
      transform: (row) => {
        // Keep all dedup keys non-null so the ON CONFLICT target always matches
        // the UNIQUE(national_id, permit_id, unit_no) constraint.
        row.national_id = row.national_id ?? '';
        row.permit_id = row.permit_id ?? '';
        row.unit_no = row.unit_no ?? 0;
        return row;
      },
    });
  }

  async run(): Promise<void> {
    console.log('[IllinoisMinePermits] Starting — IL DNR mine permit boundaries.');
    await super.run();
  }
}

export class IllinoisMineShaftsScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'il_mine_shafts',
      city: 'illinois',
      serviceUrl: `${MINES_PUBLIC_BASE}/12/query`,
      tableName: 'illinois_mine_shafts',
      fieldMap: {
        m_index:    'M_INDEX',
        shaft_type: 'TYPE',
        type_label: 'TYPE_LABEL',
        county:     'COUNTY',
        seam:       'SEAM',
        post_law:   (a) => a.POST_LAW === 1 || a.POST_LAW === '1' || a.POST_LAW === true,
        active:     (a) => a.ACTIVE === 1 || a.ACTIVE === '1' || a.ACTIVE === true,
        feature_url:'FeatureURL',
      },
      dedupFields: ['m_index'],
      orderByFields: 'OBJECTID ASC',
      pageSize: 1000,              // this server caps maxRecordCount at 1000
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'il_dnr_gis' },
    });
  }

  async run(): Promise<void> {
    console.log('[IllinoisMineShafts] Starting — ISGS documented mine shaft locations.');
    await super.run();
  }
}

export class IllinoisAggregateMinesScraper extends ArcgisScraper {
  constructor() {
    super({
      module: 'il_aggregate_mines',
      city: 'illinois',
      serviceUrl: `${MINES_PUBLIC_BASE}/13/query`,
      tableName: 'illinois_aggregate_mines',
      fieldMap: {
        site_id:    'Site_1',
        operator:   'OPERATOR',
        operation:  'Oper',
        mine_name:  'Mine',
        mineral:    (a) => [a.Mineral1, a.Mineral2].filter(Boolean).join(', ') || null,
        blasting:   (a) => a.Blasting === 1 || a.Blasting === 'Y' || a.Blasting === 'y',
        address:    (a) => [a.ADDR1, a.ADDR2].filter(Boolean).join(', ') || null,
        contact_city: 'CITY',
        state:      'STATE',
        zip:        'ZIP',
        phone:      'PHONE',
      },
      dedupFields: ['site_id'],
      orderByFields: 'OBJECTID ASC',
      pageDelayMs: 500,
      enableAlerts: false,
      staticFields: { source: 'il_dnr_gis', city: 'illinois' },
    });
  }

  async run(): Promise<void> {
    console.log('[IllinoisAggregateMines] Starting — IDNR aggregate (sand/gravel) mines.');
    await super.run();
  }
}
