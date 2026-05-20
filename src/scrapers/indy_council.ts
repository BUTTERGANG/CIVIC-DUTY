// src/scrapers/indy_council.ts
// Indianapolis City-County Council meetings from Municode Meetings Portal.
// Reuses the same pattern as the Fishers CivicClerk scraper but targets
// Indianapolis's Municode instance.

import https from 'https';
import { Scraper } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';

const API_BASE = 'https://indianapolis-in.municode.com/api/Meetings';
const API_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://indianapolis-in.municode.com',
  Referer: 'https://indianapolis-in.municode.com/',
};

const CITY = 'indy';
const SINCE = '2023-01-01';

interface MunicodeEvent {
  id: number;
  eventName: string;
  startDateTime: string;
  categoryName: string;
  eventLocation?: {
    address1?: string;
    city?: string;
    state?: string;
  };
  publishedFiles?: {
    fileId: number;
    type: string;
    name: string;
    url: string;
  }[];
}

function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: API_HEADERS }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error for ${url}: ${(e as Error).message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
  });
}

function buildLocation(loc: MunicodeEvent['eventLocation']): string {
  if (!loc) return '';
  const parts = [loc.address1, loc.city, loc.state].filter(Boolean);
  return parts.join(', ');
}

function deriveStatus(startDateTime: string): 'upcoming' | 'past' {
  return new Date(startDateTime) > new Date() ? 'upcoming' : 'past';
}

function deriveTags(categoryName: string): string[] {
  const tags: string[] = [];
  if (/council/i.test(categoryName)) tags.push('city-council');
  if (/committee/i.test(categoryName)) tags.push('committee');
  if (/public hearing/i.test(categoryName)) tags.push('public-hearing');
  if (/budget|finance/i.test(categoryName)) tags.push('budget');
  if (/zoning|land use/i.test(categoryName)) tags.push('zoning');
  if (/transportation|infrastructure/i.test(categoryName)) tags.push('infrastructure');
  if (/public safety|police|fire/i.test(categoryName)) tags.push('public-safety');
  if (tags.length === 0) tags.push('general');
  return tags;
}

export class IndyCouncilScraper implements Scraper {
  module = 'council';

  async run() {
    console.log('[IndyCouncilScraper] Starting Municode ingestion...');

    let nextUrl: string | null =
      `${API_BASE}?$filter=startDateTime ge ${SINCE}&$orderby=startDateTime asc`;

    let inserted = 0;
    let updated = 0;
    let pages = 0;

    while (nextUrl) {
      pages++;
      let data: any;
      try {
        data = await fetchJson(nextUrl);
      } catch (err) {
        console.error(`[IndyCouncilScraper] Failed to fetch page ${pages}:`, err);
        break;
      }

      const events: MunicodeEvent[] = data.value || [];
      console.log(`[IndyCouncilScraper] Page ${pages}: ${events.length} events`);

      for (const ev of events) {
        const eventId = String(ev.id);
        const title = ev.eventName;
        const date = ev.startDateTime.split('T')[0];
        const category = ev.categoryName || null;
        const location = buildLocation(ev.eventLocation);
        const status = deriveStatus(ev.startDateTime);
        const tags = deriveTags(ev.categoryName || '');

        const attachedPdfs = (ev.publishedFiles || []).map(f => ({
          fileId: f.fileId,
          type: f.type,
          label: `${f.type} (PDF)`,
          url: f.url,
        }));

        try {
          const res = await pool.query(
            `INSERT INTO council_votes
               (city, event_id, title, date, category, location, status, tags, attached_pdfs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (city, event_id) DO UPDATE SET
               title         = EXCLUDED.title,
               date          = EXCLUDED.date,
               category      = EXCLUDED.category,
               location      = EXCLUDED.location,
               status        = EXCLUDED.status,
               tags          = EXCLUDED.tags,
               attached_pdfs = EXCLUDED.attached_pdfs,
               scraped_at    = NOW()
             RETURNING id, (xmax = 0) AS is_insert`,
            [CITY, eventId, title, date, category, location, status, tags, JSON.stringify(attachedPdfs)]
          );

          if (res.rows[0]?.is_insert) {
            inserted++;
            await runAlertEngine('council', { id: res.rows[0].id, title, date, category, tags, city: CITY });
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`[IndyCouncilScraper] DB error for event ${eventId}:`, err);
        }
      }

      nextUrl = data['@odata.nextLink'] || null;
    }

    console.log(`[IndyCouncilScraper] Done. Pages: ${pages} | Inserted: ${inserted} | Updated: ${updated}`);
  }
}
