// src/scrapers/arcgis.ts
// Generic ArcGIS REST FeatureServer scraper base class.
// Handles pagination, rate limiting, field mapping, and upsert for any ArcGIS service.

import { Scraper } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';

// ── Configuration ─────────────────────────────────────────────────────────────

export interface ArcgisFieldMap {
  /** DB column name → ArcGIS attribute name (or function to extract) */
  [dbColumn: string]: string | ((attrs: Record<string, any>) => any);
}

export interface ArcgisScraperConfig {
  /** Unique key for this scraper */
  module: string;
  /** City discriminator stored in DB */
  city: string;
  /** ArcGIS FeatureServer layer URL (…/FeatureServer/0/query) */
  serviceUrl: string;
  /** DB table name to upsert into */
  tableName: string;
  /** Map DB columns → ArcGIS attribute names or extractor functions */
  fieldMap: ArcgisFieldMap;
  /** Unique key fields in DB for dedup (mapped through fieldMap) */
  dedupFields: string[];
  /** Additional WHERE clause for ArcGIS query (default: '1=1') */
  whereClause?: string;
  /** Extra outFields beyond what's in fieldMap (e.g. for filtering) */
  extraOutFields?: string[];
  /** OrderByFields parameter (default: none) */
  orderByFields?: string;
  /** Max records per page (default: 2000, ArcGIS max) */
  pageSize?: number;
  /** Delay between pages in ms (default: 1000) */
  pageDelayMs?: number;
  /** Whether geometry contains {x: lng, y: lat} (default: true with outSR=4326) */
  hasGeometry?: boolean;
  /**
   * Set true for polygon layers (e.g. parcel boundaries) so lat/lng are derived from
   * ArcGIS's `returnCentroid` param instead of raw geometry x/y (polygons have no
   * single point). Do NOT set this for point layers — `returnCentroid=true` triggers
   * a 400 "Unable to complete operation" error on point-geometry ArcGIS services.
   */
  useCentroid?: boolean;
  /** Custom transform applied after field mapping (optional) */
  transform?: (row: Record<string, any>, attrs: Record<string, any>) => Record<string, any>;
  /** Whether to run alert engine on new rows (default: true) */
  enableAlerts?: boolean;
  /** Additional static fields added to every row (e.g. source, city) */
  staticFields?: Record<string, any>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'CivicDuty/1.0 (civic data aggregator)',
};

interface ArcgisResponse {
  features?: {
    attributes: Record<string, any>;
    geometry?: { x: number; y: number } | { rings: number[][][] };
    centroid?: { x: number; y: number };
  }[];
  error?: { message: string; code: number };
  exceededTransferLimit?: boolean;
}

async function fetchArcgisPage(
  url: string,
  params: URLSearchParams,
  retries = 3,
): Promise<ArcgisResponse> {
  const fullUrl = `${url}?${params.toString()}`;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(fullUrl, { headers: API_HEADERS });
      if (res.status === 429) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[ArcGIS] 429 rate limited — retrying in ${delay}ms (${retries - attempt} left)`);
        await sleep(delay);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return await res.json() as ArcgisResponse;
    } catch (err) {
      if (attempt < retries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        console.log(`[ArcGIS] Fetch error — retrying in ${delay}ms: ${(err as Error).message}`);
        await sleep(delay);
      } else {
        throw err;
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${fullUrl}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function epochToDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString().split('T')[0];
}

function epochToTimestamp(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

// Vertex-average centroid of a polygon's outer ring. Not area-weighted (won't be
// exact for highly irregular shapes), but good enough for a representative point on
// small features like parcels — used as a fallback for ArcGIS instances where
// `returnCentroid` is accepted but doesn't actually populate `feature.centroid`
// (observed on gis.indy.gov/MapIndyProperty; see indy_parcels.ts).
function ringCentroid(rings: number[][][]): { x: number; y: number } | null {
  const outer = rings[0];
  if (!outer || outer.length === 0) return null;
  let sumX = 0;
  let sumY = 0;
  for (const [x, y] of outer) {
    sumX += x;
    sumY += y;
  }
  return { x: sumX / outer.length, y: sumY / outer.length };
}

// ── Base Scraper Class ───────────────────────────────────────────────────────

export class ArcgisScraper implements Scraper {
  module: string;
  protected config: ArcgisScraperConfig;

  constructor(config: ArcgisScraperConfig) {
    this.module = config.module;
    this.config = {
      whereClause: '1=1',
      pageSize: 2000,
      pageDelayMs: 1000,
      hasGeometry: true,
      enableAlerts: true,
      ...config,
    };
  }

  async run(): Promise<void> {
    const { serviceUrl, tableName, fieldMap, city, pageDelayMs, enableAlerts } = this.config as any;
    console.log(`[${this.module}] Starting ArcGIS scrape for ${city}...`);

    // Collect all ArcGIS field names needed
    const arcgisFields = new Set<string>();
    for (const mapper of Object.values(fieldMap)) {
      if (typeof mapper === 'string') {
        arcgisFields.add(mapper);
      } else if (typeof mapper === 'function' && (mapper as any).arcgisField) {
        // epochDateField()/epochTimestampField() tag their returned function with the
        // source field name — pick it up so it actually gets requested in outFields.
        arcgisFields.add((mapper as any).arcgisField);
      }
    }
    if (this.config.extraOutFields) {
      for (const f of this.config.extraOutFields) arcgisFields.add(f);
    }

    const outFields = Array.from(arcgisFields).join(',');

    let allFeatures: {
      attributes: Record<string, any>;
      geometry?: { x: number; y: number } | { rings: number[][][] };
      centroid?: { x: number; y: number };
    }[] = [];
    let offset = 0;
    let totalFetched = 0;
    let pages = 0;

    // Paginate through all results
    while (true) {
      pages++;
      const params = new URLSearchParams({
        where: this.config.whereClause!,
        outFields,
        outSR: '4326',
        f: 'json',
        resultRecordCount: String(this.config.pageSize),
        resultOffset: String(offset),
      });
      if (this.config.useCentroid) {
        // Only valid on polygon layers — point-geometry services 400 on this param.
        params.set('returnCentroid', 'true');
      }
      if (this.config.orderByFields) {
        params.set('orderByFields', this.config.orderByFields);
      }

      let data: ArcgisResponse;
      try {
        data = await fetchArcgisPage(serviceUrl, params);
      } catch (err) {
        console.error(`[${this.module}] Page ${pages} fetch failed:`, err);
        break;
      }

      if (data.error) {
        console.error(`[${this.module}] ArcGIS error:`, data.error.message);
        break;
      }

      const features = data.features ?? [];
      if (features.length === 0) break;

      allFeatures = allFeatures.concat(features);
      totalFetched += features.length;
      console.log(`[${this.module}] Page ${pages}: ${features.length} features (total: ${totalFetched})`);

      // If we got fewer than pageSize, we've reached the end
      if (features.length < this.config.pageSize!) break;

      // Also check exceededTransferLimit flag
      if (data.exceededTransferLimit === false) break;

      offset += features.length;
      await sleep(pageDelayMs!);
    }

    console.log(`[${this.module}] Fetched ${totalFetched} total features across ${pages} pages`);

    // Upsert into DB
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const feature of allFeatures) {
      try {
        const row = this.mapFeature(feature);
        const result = await this.upsertRow(row);
        if (result === 'insert') {
          inserted++;
        } else if (typeof result === 'object') {
          inserted++;
          if (enableAlerts) {
            await runAlertEngine(this.module, { ...row, id: result.id });
          }
        } else if (result === 'update') {
          updated++;
        }
      } catch (err) {
        errors++;
        if (errors <= 5) {
          console.error(`[${this.module}] Row error:`, err);
        }
      }
    }

    console.log(`[${this.module}] Done — ${inserted} inserted, ${updated} updated, ${errors} errors`);
  }

  protected mapFeature(feature: {
    attributes: Record<string, any>;
    geometry?: { x: number; y: number } | { rings: number[][][] };
    centroid?: { x: number; y: number };
  }): Record<string, any> {
    const { fieldMap, hasGeometry, staticFields, transform, city } = this.config;
    const attrs = feature.attributes;
    // Point layers return `geometry: {x, y}` directly. Polygon layers (e.g. parcels)
    // have no single point — ArcGIS's `returnCentroid` (see run()) is supposed to add
    // a `centroid`, but some instances accept the param and silently don't populate it
    // (observed on gis.indy.gov), so fall back to computing one from the ring vertices.
    const geo = feature.geometry;
    let point: { x: number; y: number } | undefined;
    if (geo && 'x' in geo) point = geo;
    else if (feature.centroid) point = feature.centroid;
    else if (geo && 'rings' in geo) point = ringCentroid(geo.rings) ?? undefined;

    const row: Record<string, any> = {
      city,
      ...staticFields,
    };

    // Map fields
    for (const [dbCol, mapper] of Object.entries(fieldMap)) {
      if (typeof mapper === 'string') {
        row[dbCol] = attrs[mapper] ?? null;
      } else {
        row[dbCol] = mapper(attrs);
      }
    }

    // Geometry
    if (hasGeometry && point) {
      if (!('lat' in fieldMap)) row.lat = point.y ?? null;
      if (!('lng' in fieldMap)) row.lng = point.x ?? null;
    }

    // Custom transform
    if (transform) {
      return transform(row, attrs);
    }

    return row;
  }

  protected async upsertRow(row: Record<string, any>): Promise<'insert' | 'update' | 'noop' | { id: number }> {
    const { tableName, dedupFields, fieldMap } = this.config;

    // Build column list and values
    const columns = Object.keys(row);
    const values = columns.map((_, i) => `$${i + 1}`);

    // Build the insert query
    const insertSql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;

    // Build ON CONFLICT clause
    const conflictFields = dedupFields.filter(f => row[f] !== null && row[f] !== undefined);
    if (conflictFields.length === 0) {
      // No dedup possible — just insert
      const res = await pool.query(insertSql, Object.values(row));
      return res.rows[0]?.id ? { id: res.rows[0].id } : 'insert';
    }

    const updateFields = columns.filter(c => !conflictFields.includes(c) && c !== 'city');
    const updateSet = updateFields.map(f => `${f} = EXCLUDED.${f}`).concat(['scraped_at = NOW()']);

    const sql = `${insertSql}
      ON CONFLICT (${conflictFields.join(', ')}) DO UPDATE SET
        ${updateSet.join(', ')}
      RETURNING id, (xmax = 0) AS is_insert`;

    const res = await pool.query(sql, Object.values(row));
    if (res.rows[0]?.is_insert) {
      return res.rows[0]?.id ? { id: res.rows[0].id } : 'insert';
    }
    return 'update';
  }
}

// ── Convenience: epoch date/timestamp extractors ─────────────────────────────

export function epochDateField(arcgisField: string): (attrs: Record<string, any>) => string | null {
  const fn = (attrs: Record<string, any>) => epochToDate(attrs[arcgisField]);
  fn.arcgisField = arcgisField;
  return fn;
}

export function epochTimestampField(arcgisField: string): (attrs: Record<string, any>) => string | null {
  const fn = (attrs: Record<string, any>) => epochToTimestamp(attrs[arcgisField]);
  fn.arcgisField = arcgisField;
  return fn;
}

export function epochDateToCol(arcgisField: string, dbCol: string): ArcgisFieldMap {
  return { [dbCol]: epochDateField(arcgisField) };
}

export function epochTimestampToCol(arcgisField: string, dbCol: string): ArcgisFieldMap {
  return { [dbCol]: epochTimestampField(arcgisField) };
}
