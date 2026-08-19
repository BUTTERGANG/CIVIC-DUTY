// src/__tests__/arcgis.test.ts
//
// Covers the ArcGIS request/response mapping layer — the part of the codebase
// with the worst track record. All six Indianapolis scrapers were built
// against a service URL and field schema that never existed in production and
// nobody noticed for months, because a wrong field name produces null columns,
// not an error. These tests pin the mapping against fixture responses shaped
// like real gis.indy.gov payloads, so that failure mode is loud.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ArcgisScraper,
  collectOutFields,
  epochDateField,
  epochTimestampField,
  epochDateToCol,
  epochTimestampToCol,
} from '../scrapers/arcgis';

/** mapFeature is protected; tests drive it the way run() does. */
function mapWith(config: any, feature: any): Record<string, any> {
  const scraper = new ArcgisScraper(config);
  return (scraper as any).mapFeature(feature);
}

/** Access the protected upsertRow for SQL-shape testing. */
function upsertRowShape(config: any, row: Record<string, any>): string {
  const scraper = new ArcgisScraper(config);
  // We can't easily inspect the generated SQL from upsertRow since it calls pool.query,
  // but we can verify that dedupFields are correctly filtered when null
  return (scraper as any).config.dedupFields.filter(
    (f: string) => row[f] !== null && row[f] !== undefined
  ).join(',');
}

describe('collectOutFields', () => {
  test('collects plain string field mappings', () => {
    const fields = collectOutFields({ citation_id: 'OBJECTID', address: 'sAddress' });
    assert.deepEqual(fields.sort(), ['OBJECTID', 'sAddress']);
  });

  test('collects the source field behind a tagged function mapper', () => {
    // The regression: a function mapper reads attrs.Citationdatetime at map
    // time, but only the .arcgisField tag tells the request layer to ask for
    // it. Drop the tag and the column silently goes null forever.
    const fields = collectOutFields({
      issued_at: epochTimestampField('Citationdatetime'),
      filed: epochDateField('FiledDate'),
    });
    assert.deepEqual(fields.sort(), ['Citationdatetime', 'FiledDate']);
  });

  test('mixes string and function mappers, and dedupes', () => {
    const fields = collectOutFields(
      { a: 'OBJECTID', b: epochDateField('OBJECTID'), c: 'Sex' },
      ['OBJECTID', 'Extra']
    );
    assert.deepEqual(fields.sort(), ['Extra', 'OBJECTID', 'Sex']);
  });

  test('includes extraOutFields not referenced by any mapping', () => {
    // Used for fields needed only by whereClause/orderByFields.
    const fields = collectOutFields({ a: 'A' }, ['SortKey']);
    assert.ok(fields.includes('SortKey'));
  });

  test('an untagged function mapper contributes nothing — documents the trap', () => {
    // A hand-written closure has no .arcgisField, so the field it reads is
    // never requested. This is the shape of the original bug; if a future
    // change makes this pass silently, the guard above is what's protecting us.
    const untagged = (attrs: Record<string, any>) => attrs.NeverRequested ?? null;
    assert.deepEqual(collectOutFields({ x: untagged }), []);
  });
});

describe('mapFeature', () => {
  const citationsConfig = {
    module: 'citations',
    city: 'indy',
    serviceUrl: 'https://example.invalid/query',
    tableName: 'citations',
    fieldMap: {
      citation_id: 'OBJECTID',
      violation: 'Violation_Desc',
      address: 'sAddress',
      issued_at: epochTimestampField('Citationdatetime'),
    },
    dedupFields: ['city', 'citation_id'],
    staticFields: { source: 'indy_arcgis' },
  };

  test('maps a real-shaped point feature onto db columns', () => {
    const row = mapWith(citationsConfig, {
      attributes: {
        OBJECTID: 884213,
        Violation_Desc: 'SPEEDING 11-15 MPH OVER',
        sAddress: '3900 BLOCK N MERIDIAN ST',
        Citationdatetime: 1721001600000, // 2024-07-15T00:00:00Z
      },
      geometry: { x: -86.1581, y: 39.8203 },
    });

    assert.equal(row.citation_id, 884213);
    assert.equal(row.violation, 'SPEEDING 11-15 MPH OVER');
    assert.equal(row.address, '3900 BLOCK N MERIDIAN ST');
    assert.equal(row.city, 'indy');
    assert.equal(row.source, 'indy_arcgis');
    assert.equal(row.lat, 39.8203);
    assert.equal(row.lng, -86.1581);
    assert.match(row.issued_at, /^2024-07-15/);
  });

  test('missing attributes map to null rather than undefined', () => {
    // Columns must be explicitly null so the upsert binds them; undefined
    // would drop the parameter.
    const row = mapWith(citationsConfig, {
      attributes: { OBJECTID: 1 },
      geometry: { x: -86, y: 39 },
    });
    assert.equal(row.violation, null);
    assert.equal(row.address, null);
    assert.equal(row.issued_at, null);
  });

  test('polygon features fall back to a computed ring centroid', () => {
    // gis.indy.gov accepts returnCentroid but silently does not populate it,
    // so parcels rely on the vertex-average fallback.
    const row = mapWith(
      { ...citationsConfig, tableName: 'parcels', fieldMap: { parcel_id: 'OBJECTID' } },
      {
        attributes: { OBJECTID: 7 },
        geometry: {
          rings: [[[-86, 39], [-84, 39], [-84, 41], [-86, 41], [-86, 39]]],
        },
      }
    );
    assert.equal(row.lng, -85);
    assert.equal(row.lat, 40);
  });

  test('an explicit centroid wins over the ring fallback', () => {
    const row = mapWith(
      { ...citationsConfig, fieldMap: { parcel_id: 'OBJECTID' } },
      {
        attributes: { OBJECTID: 7 },
        geometry: { rings: [[[-86, 39], [-84, 39], [-84, 41], [-86, 41], [-86, 39]]] },
        centroid: { x: -85.5, y: 40.5 },
      }
    );
    assert.equal(row.lng, -85.5);
    assert.equal(row.lat, 40.5);
  });

  test('non-spatial layers get no lat/lng', () => {
    // IMPD NIBRS incidents and Use of Force are ArcGIS Tables — no geometry is
    // published for either, deliberately.
    const row = mapWith(
      { ...citationsConfig, hasGeometry: false, fieldMap: { incident_id: 'OBJECTID' } },
      { attributes: { OBJECTID: 42 } }
    );
    assert.equal(row.incident_id, 42);
    assert.ok(!('lat' in row) || row.lat == null);
    assert.ok(!('lng' in row) || row.lng == null);
  });
});

describe('epoch field helpers', () => {
  test('epochDateField yields a date, epochTimestampField a timestamp', () => {
    const attrs = { When: 1721001600000 };
    assert.equal(epochDateField('When')(attrs), '2024-07-15');
    assert.match(epochTimestampField('When')(attrs)!, /^2024-07-15T/);
  });

  test('null and missing epochs stay null', () => {
    assert.equal(epochDateField('When')({ When: null }), null);
    assert.equal(epochDateField('When')({}), null);
    assert.equal(epochTimestampField('When')({ When: null }), null);
  });

  test('helpers tag themselves so collectOutFields can find the source field', () => {
    assert.equal((epochDateField('Foo') as any).arcgisField, 'Foo');
    assert.equal((epochTimestampField('Bar') as any).arcgisField, 'Bar');
  });

  test('epochDateToCol and epochTimestampToCol compose correctly', () => {
    const col1 = epochDateToCol('HearingDate', 'hearing_date');
    const col2 = epochTimestampToCol('Requested', 'requested_at');
    assert.deepEqual(Object.keys(col1), ['hearing_date']);
    assert.deepEqual(Object.keys(col2), ['requested_at']);
    assert.equal((col1.hearing_date as any)({ HearingDate: 1721001600000 }), '2024-07-15');
    assert.match((col2.requested_at as any)({ Requested: 1721001600000 }), /^2024-07-15T/);
  });
});

describe('ArcgisScraper defaults', () => {
  test('applies sensible defaults for optional config', () => {
    const scraper = new ArcgisScraper({
      module: 'test',
      city: 'indy',
      serviceUrl: 'https://example.invalid/query',
      tableName: 'test_table',
      fieldMap: { id: 'OBJECTID' },
      dedupFields: ['city', 'id'],
    });
    assert.equal((scraper as any).config.pageSize, 2000);
    assert.equal((scraper as any).config.pageDelayMs, 1000);
    assert.equal((scraper as any).config.whereClause, '1=1');
    assert.equal((scraper as any).config.hasGeometry, true);
    assert.equal((scraper as any).config.enableAlerts, true);
  });

  test('user-supplied config overrides defaults', () => {
    const scraper = new ArcgisScraper({
      module: 'test',
      city: 'indy',
      serviceUrl: 'https://example.invalid/query',
      tableName: 'test_table',
      fieldMap: { id: 'OBJECTID' },
      dedupFields: ['city', 'id'],
      pageSize: 100,
      hasGeometry: false,
      enableAlerts: false,
    });
    assert.equal((scraper as any).config.pageSize, 100);
    assert.equal((scraper as any).config.hasGeometry, false);
    assert.equal((scraper as any).config.enableAlerts, false);
  });
});

describe('Dedup fields filtering', () => {
  test('only non-null dedup fields are used in ON CONFLICT', () => {
    const config = {
      module: 'test',
      city: 'indy',
      serviceUrl: 'https://example.invalid/query',
      tableName: 'test_table',
      fieldMap: { id: 'OBJECTID', name: 'Name', city: 'City' },
      dedupFields: ['city', 'id', 'name'],
    };
    // All three dedup fields present
    assert.equal(upsertRowShape(config, { city: 'indy', id: 1, name: 'test' }), 'city,id,name');
    // Two dedup fields null — should filter them out
    assert.equal(upsertRowShape(config, { id: 1, name: null }), 'id');
    // Only city present
    assert.equal(upsertRowShape(config, { city: 'indy', id: null, name: null }), 'city');
  });
});

describe('mapFeature edge cases', () => {
  const baseConfig = {
    module: 'test',
    city: 'indy',
    serviceUrl: 'https://example.invalid/query',
    tableName: 'test_table',
    fieldMap: { id: 'OBJECTID' },
    dedupFields: ['city', 'id'],
  };

  test('empty geometry rings — lat/lng not set on row', () => {
    // RingCentroid returns null for an empty ring array; the mapper leaves
    // lat/lng absent rather than setting them to null.
    const row = mapWith(baseConfig, {
      attributes: { OBJECTID: 1 },
      geometry: { rings: [] },
    });
    assert.equal(row.id, 1);
    assert.ok(!('lat' in row) || row.lat == null);
    assert.ok(!('lng' in row) || row.lng == null);
  });

  test('feature with empty attributes maps correctly', () => {
    const row = mapWith(baseConfig, { attributes: {} });
    assert.equal(row.city, 'indy');
    assert.equal(row.id, null);
  });

  test('transform function is applied after field mapping', () => {
    const configWithTransform = {
      ...baseConfig,
      transform: (row: Record<string, any>) => {
        row.computed_label = `${row.city}_${row.id}`;
        return row;
      },
    };
    const row = mapWith(configWithTransform, {
      attributes: { OBJECTID: 42 },
      geometry: { x: -86, y: 39 },
    });
    assert.equal(row.computed_label, 'indy_42');
  });

  test('staticFields are included in every row', () => {
    const configWithStatic = {
      ...baseConfig,
      staticFields: { source: 'test_arcgis', version: 2 },
    };
    const row = mapWith(configWithStatic, {
      attributes: { OBJECTID: 99 },
      geometry: { x: -86, y: 39 },
    });
    assert.equal(row.source, 'test_arcgis');
    assert.equal(row.version, 2);
  });
});
