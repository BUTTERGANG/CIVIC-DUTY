// src/scrapers/zoning.ts
// Pulls live zoning/planning hearing notices from Fishers, IN ArcGIS FeatureServer.
// Source: PublicNoticePoints_ViewOnly — Plan Commission, City Council, BZA items.
// No Playwright needed; the endpoint returns plain JSON with no auth required.

import { Scraper } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';

const PUBLIC_NOTICE_URL =
  'https://services.arcgis.com/CLuli6D9IiF45RRj/arcgis/rest/services/PublicNoticePoints_ViewOnly/FeatureServer/0/query';

const DEV_PROJECTS_URL =
  'https://services.arcgis.com/CLuli6D9IiF45RRj/arcgis/rest/services/Development_Projects_view/FeatureServer/0/query';

// ── Types ────────────────────────────────────────────────────────────────────

interface NoticeAttributes {
  OBJECTID: number;
  Type: string | null;          // "Advisory Plan Commission" | "City Council" | "Board of Zoning Appeals"
  MeetingDate: number | null;   // epoch ms
  MeetingLocation: string | null;
  MeetingAddress: string | null;
  PropertyAddress: string | null;
  PropertyDescript: string | null;
  Petitioner: string | null;
  Request: string | null;       // full description — may contain zone info
  Docket: string | null;        // e.g. "RZ-26-3", "VA-26-1", "TA-26-1"
  Notice: string | null;
  Agenda: string | null;
  CityStaff: string | null;
  CityStaffEmail: string | null;
  CityStaffPhone: string | null;
  CreationDate: number | null;  // epoch ms — when notice was posted
}

interface NoticeFeature {
  attributes: NoticeAttributes;
  geometry: { x: number; y: number } | null; // WGS84 lng/lat when outSR=4326
}

interface ArcGISResponse {
  features?: NoticeFeature[];
  error?: { message: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Epoch ms → "YYYY-MM-DD" or null */
function epochToDate(ms: number | null): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString().split('T')[0];
}

/**
 * Attempt to parse the "from" zone code from a rezone request description.
 * e.g. "Rezone from AG to R1" → "AG"
 */
function parseFromZone(request: string | null): string | null {
  if (!request) return null;
  const m = request.match(/\brezone[d]?\s+(?:from\s+)?([A-Z][A-Z0-9\-]+)\s+to\b/i);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Attempt to parse the "to" zone code from a rezone request description.
 * e.g. "Rezone from AG to R1" → "R1"
 */
function parseToZone(request: string | null): string | null {
  if (!request) return null;
  const m = request.match(/\brezone[d]?\s+(?:from\s+[A-Z][A-Z0-9\-]+\s+)?to\s+([A-Z][A-Z0-9\-]+)\b/i);
  return m ? m[1].toUpperCase() : null;
}

/** Extract 2–4 character type code from docket number (RZ, VA, SE, TA, DP…) */
function docketTypeCode(docket: string | null): string | null {
  if (!docket) return null;
  const m = docket.match(/^([A-Z]+)-/);
  return m ? m[1] : null;
}

// ── Scraper ──────────────────────────────────────────────────────────────────

export class ZoningScraper implements Scraper {
  module = 'zoning';

  async run() {
    console.log('[ZoningScraper] Running...');

    // outSR=4326 requests WGS84 coordinates so geometry.x = lng, geometry.y = lat
    const url = new URL(PUBLIC_NOTICE_URL);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', '*');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('orderByFields', 'MeetingDate DESC');
    url.searchParams.set('f', 'json');

    let data: ArcGISResponse;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      data = await res.json() as ArcGISResponse;
    } catch (err) {
      console.error('[ZoningScraper] Fetch error:', err);
      return;
    }

    if (data.error) {
      console.error('[ZoningScraper] ArcGIS error:', data.error.message);
      return;
    }

    const features = data.features ?? [];
    if (features.length === 0) {
      console.log('[ZoningScraper] No public notice features returned');
      return;
    }

    console.log(`[ZoningScraper] ${features.length} public notice(s) fetched`);
    let inserted = 0;
    let updated = 0;

    for (const feature of features) {
      const a = feature.attributes;
      const geo = feature.geometry;

      const lat = geo?.y ?? null;
      const lng = geo?.x ?? null;

      const now = new Date();
      const meetingDate = a.MeetingDate ? new Date(a.MeetingDate) : null;
      const status = meetingDate
        ? meetingDate > now ? 'scheduled' : 'heard'
        : 'unknown';

      const address = a.PropertyAddress ?? a.MeetingAddress ?? 'Unknown';
      const filedDate = epochToDate(a.CreationDate);
      const hearingDate = epochToDate(a.MeetingDate);

      const row = {
        address,
        applicant: a.Petitioner,
        from_zone: parseFromZone(a.Request),
        to_zone: parseToZone(a.Request),
        filed_date: filedDate,
        hearing_date: hearingDate,
        status,
        lat,
        lng,
        docket: a.Docket,
        board: a.Type,
        request_type: docketTypeCode(a.Docket),
        description: a.Request,
        city_staff: a.CityStaff,
        city_staff_email: a.CityStaffEmail,
      };

      try {
        let dbRes;

        if (a.Docket) {
          // Primary path: upsert on docket — updates status + description on re-run
          // Use CTE-based upsert since partial unique indexes can't be used with ON CONFLICT
          dbRes = await pool.query(
            `WITH existing AS (
               SELECT id FROM zoning_changes WHERE docket = $10 LIMIT 1
             ),
             do_update AS (
               UPDATE zoning_changes SET
                 status           = $7,
                 hearing_date     = $6,
                 description      = $13,
                 address          = $1,
                 applicant        = $2,
                 board            = $11,
                 city_staff       = $14,
                 city_staff_email = $15,
                 scraped_at       = NOW()
               WHERE docket = $10
               RETURNING id, FALSE AS is_insert
             ),
             do_insert AS (
               INSERT INTO zoning_changes
                 (address, applicant, from_zone, to_zone, filed_date, hearing_date, status,
                  lat, lng, docket, board, request_type, description, city_staff, city_staff_email)
               SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
               WHERE NOT EXISTS (SELECT 1 FROM existing)
               RETURNING id, TRUE AS is_insert
             )
             SELECT * FROM do_update UNION ALL SELECT * FROM do_insert`,
            [
              row.address, row.applicant, row.from_zone, row.to_zone,
              row.filed_date, row.hearing_date, row.status,
              row.lat, row.lng,
              row.docket, row.board, row.request_type,
              row.description, row.city_staff, row.city_staff_email,
            ]
          );
        } else {
          // Fallback: records without a docket number — dedup on (address, filed_date)
          dbRes = await pool.query(
            `INSERT INTO zoning_changes
               (address, applicant, from_zone, to_zone, filed_date, hearing_date, status,
                lat, lng, board, request_type, description, city_staff, city_staff_email)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
             ON CONFLICT (address, filed_date) DO NOTHING
             RETURNING id, TRUE AS is_insert`,
            [
              row.address, row.applicant, row.from_zone, row.to_zone,
              row.filed_date, row.hearing_date, row.status,
              row.lat, row.lng,
              row.board, row.request_type,
              row.description, row.city_staff, row.city_staff_email,
            ]
          );
        }

        if (dbRes.rowCount && dbRes.rowCount > 0) {
          const isInsert = dbRes.rows[0].is_insert;
          if (isInsert) {
            inserted++;
            console.log(`[ZoningScraper] Inserted ${row.docket ?? address}`);
            await runAlertEngine('zoning', { ...row, id: dbRes.rows[0].id });
          } else {
            updated++;
            console.log(`[ZoningScraper] Updated  ${row.docket ?? address}`);
          }
        }
      } catch (err) {
        console.error(`[ZoningScraper] DB error for ${a.Docket ?? address}:`, err);
      }
    }

    console.log(`[ZoningScraper] Public notices done — ${inserted} inserted, ${updated} updated`);

    await this.syncDevProjects();
  }

  private async syncDevProjects(): Promise<void> {
    console.log('[ZoningScraper] Fetching development projects...');

    const url = new URL(DEV_PROJECTS_URL);
    url.searchParams.set('where', '1=1');
    url.searchParams.set('outFields', 'Name,Location,Description,Applicant,Est_Start,Est_Completion,Status,Type,ContactName,ContactEmail');
    url.searchParams.set('returnCentroid', 'true');
    url.searchParams.set('outSR', '4326');
    url.searchParams.set('f', 'json');

    let data: any;
    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error('[ZoningScraper] Dev projects fetch error:', err);
      return;
    }

    const features: any[] = data.features ?? [];
    console.log(`[ZoningScraper] ${features.length} development project(s) fetched`);

    let dpInserted = 0, dpUpdated = 0;

    for (const feature of features) {
      const a = feature.attributes;
      const centroid = feature.centroid ?? null; // {x: lng, y: lat} when returnCentroid=true

      const projectName = a.Name ?? null;
      if (!projectName) continue;

      const status = (a.Status ?? 'unknown').toLowerCase();

      try {
        const res = await pool.query(
          `WITH existing AS (
             SELECT id FROM zoning_changes WHERE project_name = $1 AND source = 'dev_project' LIMIT 1
           ),
           do_update AS (
             UPDATE zoning_changes SET
               status         = $6,
               description    = $5,
               est_completion = $11,
               scraped_at     = NOW()
             WHERE project_name = $1 AND source = 'dev_project'
             RETURNING id, FALSE AS is_insert
           ),
           do_insert AS (
             INSERT INTO zoning_changes
               (source, project_name, project_type, address, applicant, description,
                status, lat, lng, contact_name, contact_email, est_completion,
                filed_date, hearing_date)
             SELECT 'dev_project',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NULL,NULL
             WHERE NOT EXISTS (SELECT 1 FROM existing)
             RETURNING id, TRUE AS is_insert
           )
           SELECT * FROM do_update UNION ALL SELECT * FROM do_insert`,
          [
            projectName,
            a.Type ?? null,
            a.Location ?? projectName,
            a.Applicant ?? null,
            a.Description ?? null,
            status,
            centroid?.y ?? null,
            centroid?.x ?? null,
            a.ContactName ?? null,
            a.ContactEmail ?? null,
            a.Est_Completion ?? null,
          ]
        );

        if (res.rowCount && res.rowCount > 0) {
          if (res.rows[0].is_insert) dpInserted++;
          else dpUpdated++;
        }
      } catch (err) {
        console.error(`[ZoningScraper] Dev project DB error for "${projectName}":`, err);
      }
    }

    console.log(`[ZoningScraper] Dev projects done — ${dpInserted} inserted, ${dpUpdated} updated`);
  }
}
