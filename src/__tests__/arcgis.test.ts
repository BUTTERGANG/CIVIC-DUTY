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
} from '../scrapers/arcgis';

/** mapFeature is protected; tests drive it the way run() does. */
function mapWith(config: any, feature: any): Record<string, any> {
  const scraper = new ArcgisScraper(config);
  return (scraper as any).mapFeature(feature);
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
});
