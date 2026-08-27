// src/scrapers/council.ts
import https from 'https';
import { Scraper } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';
import { processMinutesPdfs, processAgendaPdfs, processPerItemPdfs } from './pdf';

const API_BASE = 'https://fishersin.api.civicclerk.com/v1';
const API_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://fishersin.portal.civicclerk.com',
  Referer: 'https://fishersin.portal.civicclerk.com/',
};

// Earliest date to ingest (first entry in CivicClerk portal)
const SINCE = '2023-01-04';

interface PublishedFile {
  fileId: number;
  type: string; // 'Agenda' | 'Agenda Packet' | 'Minutes' | 'Notice'
  name: string;
  url: string;
}

interface EventLocation {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zipCode: string;
}

interface CivicClerkEvent {
  id: number;
  eventName: string;
  startDateTime: string;
  categoryName: string;
  eventLocation: EventLocation;
  publishedFiles: PublishedFile[];
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: API_HEADERS }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${(e as Error).message}`)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function buildFileStreamUrl(fileId: number): string {
  return `${API_BASE}/Meetings/GetMeetingFileStream(fileId=${fileId},plainText=false)`;
}

function buildLocation(loc: EventLocation): string {
  const parts = [loc.address1, loc.address2, loc.city, loc.state].filter(Boolean);
  return parts.join(', ').trim();
}

function deriveStatus(startDateTime: string): 'upcoming' | 'past' {
  return new Date(startDateTime) > new Date() ? 'upcoming' : 'past';
}

function deriveTags(categoryName: string): string[] {
  const tags: string[] = [];
  if (/council/i.test(categoryName)) tags.push('city-council');
  if (/plan commission/i.test(categoryName)) tags.push('planning');
  if (/zoning/i.test(categoryName)) tags.push('zoning');
  if (/public works/i.test(categoryName)) tags.push('public-works');
  if (/redevelopment/i.test(categoryName)) tags.push('redevelopment');
  if (/park/i.test(categoryName)) tags.push('parks');
  if (/finance|budget/i.test(categoryName)) tags.push('budget');
  if (tags.length === 0) tags.push('general');
  return tags;
}

export class CouncilScraper implements Scraper {
  module = 'council';

  async run() {
    console.log('[CouncilScraper] Starting CivicClerk ingestion...');

    let nextUrl: string | null =
      `${API_BASE}/Events?$filter=startDateTime ge ${SINCE}&$orderby=startDateTime asc`;

    let inserted = 0;
    let updated = 0;
    let pages = 0;

    while (nextUrl) {
      pages++;
      let data: any;
      try {
        data = await fetchJson(nextUrl);
      } catch (err) {
        console.error(`[CouncilScraper] Failed to fetch page ${pages}:`, err);
        break;
      }

      const events: CivicClerkEvent[] = data.value || [];
      console.log(`[CouncilScraper] Page ${pages}: ${events.length} events`);

      for (const ev of events) {
        const eventId = String(ev.id);
        const title = ev.eventName;
        const date = ev.startDateTime.split('T')[0];
        const category = ev.categoryName || null;
        const location = buildLocation(ev.eventLocation);
        const status = deriveStatus(ev.startDateTime);
        const tags = deriveTags(ev.categoryName || '');

        // Exclude Agenda Packets — too large (~10 MB each); store fileId so they can be fetched on demand
        const attachedPdfs = (ev.publishedFiles || [])
          .filter(f => f.type !== 'Agenda Packet')
          .map(f => ({
            fileId: f.fileId,
            type: f.type,
            label: `${f.type} (PDF)`,
            url: buildFileStreamUrl(f.fileId),
          }));

        const meetingId = (ev as any).agendaId || null;

        try {
          const res = await pool.query(
            `INSERT INTO council_votes
               (event_id, title, date, category, location, status, tags, attached_pdfs, meeting_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (event_id) DO UPDATE SET
               title         = EXCLUDED.title,
               date          = EXCLUDED.date,
               category      = EXCLUDED.category,
               location      = EXCLUDED.location,
               status        = EXCLUDED.status,
               tags          = EXCLUDED.tags,
               attached_pdfs = EXCLUDED.attached_pdfs,
               meeting_id    = EXCLUDED.meeting_id,
               scraped_at    = NOW()
             RETURNING id, (xmax = 0) AS is_insert`,
            [eventId, title, date, category, location, status, tags, JSON.stringify(attachedPdfs), meetingId]
          );

          if (res.rows[0]?.is_insert) {
            inserted++;
            await runAlertEngine('council', { id: res.rows[0].id, title, date, category, tags });
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`[CouncilScraper] DB error for event ${eventId}:`, err);
        }
      }

      nextUrl = data['@odata.nextLink'] || null;
    }

    console.log(`[CouncilScraper] Done. Pages: ${pages} | Inserted: ${inserted} | Updated: ${updated}`);

    // After syncing events, parse unparsed PDFs (run in parallel)
    await Promise.all([processMinutesPdfs(), processAgendaPdfs(), processPerItemPdfs()]);
  }
}
