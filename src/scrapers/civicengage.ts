// src/scrapers/civicengage.ts
// Zionsville Town Council meetings from CivicEngage Agenda Center.
// CivicEngage renders meeting data as server-side HTML tables with no JSON API,
// so we use Playwright to extract the DOM structure.

import { Scraper, withBrowser } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';

const AGENDA_URL = 'https://www.zionsville-in.gov/AgendaCenter/Zionsville-Town-Council-10';
const CITY = 'zionsville';
const SINCE = '2023-01-01';

// Years to scrape — CivicEngage shows one year at a time via ?dateSelector=
const YEARS = ['2026', '2025', '2024', '2023'];

interface AttachedPdf {
  type: string;  // 'Agenda' | 'Minutes' | 'Packet' | 'HTML'
  label: string;
  url: string;
}

interface ScrapedMeeting {
  eventId: string;
  title: string;
  date: string;          // YYYY-MM-DD
  category: string | null;
  minutesUrl: string | null;
  mediaUrl: string | null;
  attachedPdfs: AttachedPdf[];
}

function deriveStatus(dateStr: string): 'upcoming' | 'past' {
  return new Date(dateStr) > new Date() ? 'upcoming' : 'past';
}

function deriveTags(category: string | null): string[] {
  const tags: string[] = [];
  if (category && /council/i.test(category)) tags.push('city-council');
  if (category && /special/i.test(category)) tags.push('special-meeting');
  if (category && /budget/i.test(category)) tags.push('budget');
  if (category && /workshop/i.test(category)) tags.push('workshop');
  if (tags.length === 0) tags.push('general');
  return tags;
}

/**
 * Parse a human-readable date string (e.g. "Aug 31, 2026 — Posted ...") to YYYY-MM-DD.
 */
function parseDate(raw: string): string | null {
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };

  const m = raw.match(/([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})/);
  if (!m) return null;

  const month = months[m[1].toLowerCase()];
  if (!month) return null;

  return `${m[3]}-${month}-${String(parseInt(m[2], 10)).padStart(2, '0')}`;
}

/**
 * Parse the meeting category from the title string.
 */
function parseCategory(title: string): string | null {
  const lower = title.toLowerCase().replace(/^\d{4}\s*/, '');
  if (/budget workshop/i.test(lower)) return 'Town Council Budget Workshop';
  if (/(^|\s)workshop($|\s)/i.test(lower)) return 'Town Council Workshop';
  if (/special meeting/i.test(lower)) return 'Town Council Special Meeting';
  return 'Town Council Meeting';
}

export class ZionsvilleCouncilScraper implements Scraper {
  module = 'council';

  async run() {
    console.log(`[ZionsvilleCouncilScraper] Starting CivicEngage ingestion for ${CITY}...`);

    let inserted = 0;
    let updated = 0;
    let totalFound = 0;

    for (const year of YEARS) {
      const url = `${AGENDA_URL}?dateSelector=${year}`;
      console.log(`[ZionsvilleCouncilScraper] Fetching year ${year} from ${url}`);

      let meetings: ScrapedMeeting[];
      try {
        meetings = await this.fetchMeetings(url);
      } catch (err) {
        console.error(`[ZionsvilleCouncilScraper] Failed to fetch year ${year}:`, err);
        continue;
      }

      console.log(`[ZionsvilleCouncilScraper] Year ${year}: found ${meetings.length} meetings`);

      // Filter to only meetings since SINCE
      const sinceDate = new Date(SINCE);
      const filtered = meetings.filter(m => new Date(m.date) >= sinceDate);

      for (const m of filtered) {
        totalFound++;
        const status = deriveStatus(m.date);
        const tags = deriveTags(m.category);

        try {
          const res = await pool.query(
            `INSERT INTO council_votes
               (city, event_id, title, date, category, status, tags, attached_pdfs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (city, event_id) DO UPDATE SET
               title         = EXCLUDED.title,
               date          = EXCLUDED.date,
               category      = EXCLUDED.category,
               status        = EXCLUDED.status,
               tags          = EXCLUDED.tags,
               attached_pdfs = EXCLUDED.attached_pdfs,
               scraped_at    = NOW()
             RETURNING id, (xmax = 0) AS is_insert`,
            [CITY, m.eventId, m.title, m.date, m.category, status, tags, JSON.stringify(m.attachedPdfs)]
          );

          if (res.rows[0]?.is_insert) {
            inserted++;
            await runAlertEngine('council', {
              id: res.rows[0].id,
              title: m.title,
              date: m.date,
              category: m.category,
              tags,
              city: CITY,
            });
          } else {
            updated++;
          }
        } catch (err) {
          console.error(`[ZionsvilleCouncilScraper] DB error for event ${m.eventId}:`, err);
        }
      }
    }

    console.log(
      `[ZionsvilleCouncilScraper] Done. Years: ${YEARS.length} | Total found: ${totalFound} | ` +
      `Inserted: ${inserted} | Updated: ${updated}`
    );
  }

  private async fetchMeetings(url: string): Promise<ScrapedMeeting[]> {
    return withBrowser(async (page) => {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Give any JS-rendered table a moment to stabilize
      await page.waitForTimeout(2000);

      const meetings = await page.evaluate(() => {
        const results: Array<{
          id: string;
          name: string;
          title: string;
          minutesHref: string | null;
          mediaHref: string | null;
          rowText: string;
        }> = [];

        // Find all agenda title anchors
        const anchors = document.querySelectorAll<HTMLAnchorElement>(
          'a[id][name][href*="/AgendaCenter/ViewFile/Agenda/_"]'
        );

        anchors.forEach((a) => {
          const name = a.getAttribute('name');
          const title = a.textContent?.trim() || '';
          if (!name || !title) return;

          const row = a.closest('tr');
          let minutesHref: string | null = null;
          let mediaHref: string | null = null;
          let rowText = '';

          if (row) {
            rowText = row.textContent?.trim() || '';

            const minutesLink = row.querySelector<HTMLAnchorElement>(
              'a[href*="/AgendaCenter/ViewFile/Minutes/_"]'
            );
            if (minutesLink) {
              minutesHref = minutesLink.getAttribute('href');
            }

            const mediaLinks = row.querySelectorAll<HTMLAnchorElement>('a[href*="youtube.com"]');
            if (mediaLinks.length > 0) {
              mediaHref = mediaLinks[0].getAttribute('href');
            }
          }

          results.push({ id: a.id, name, title, minutesHref, mediaHref, rowText });
        });

        return results;
      });

      const baseUrl = 'https://www.zionsville-in.gov';
      const scraped: ScrapedMeeting[] = [];

      for (const m of meetings) {
        const eventId = m.name;
        if (!eventId) continue;

        // Primary: parse date from the title text (always includes date)
        let date = parseDate(m.title);

        // Secondary: parse date from the row text (h3 header)
        if (!date) {
          date = parseDate(m.rowText);
        }

        // Tertiary: reconstruct date from anchor ID (MMDDYYYY-NNNN)
        if (!date) {
          const idMatch = m.id.match(/^(\d{2})(\d{2})(\d{4})/);
          if (idMatch) {
            const [, mm, dd, yyyy] = idMatch;
            date = `${yyyy}-${mm}-${dd}`;
          }
        }

        if (!date) {
          console.warn(`[ZionsvilleCouncilScraper] Could not parse date for event ${eventId}: ${m.title}`);
          continue;
        }

        // Build full URLs for minutes
        let minutesUrl: string | null = null;
        if (m.minutesHref) {
          minutesUrl = m.minutesHref.startsWith('http')
            ? m.minutesHref
            : `${baseUrl}${m.minutesHref}`;
        }

        scraped.push({
          eventId,
          title: m.title,
          date,
          category: parseCategory(m.title),
          minutesUrl,
          mediaUrl: m.mediaHref,
          attachedPdfs: buildAttachedPdfs(eventId, minutesUrl, baseUrl),
        });
      }

      return scraped;
    });
  }
}

/**
 * Build the attached_pdfs array from what we know.
 * CivicEngage has standard download endpoints: Agenda (HTML+PDF), Packet, Minutes.
 */
function buildAttachedPdfs(
  eventId: string,
  minutesUrl: string | null,
  baseUrl: string
): AttachedPdf[] {
  const pdfs: AttachedPdf[] = [];

  // Agenda HTML (human-readable)
  pdfs.push({
    type: 'Agenda HTML',
    label: 'Agenda (HTML)',
    url: `${baseUrl}/AgendaCenter/ViewFile/Agenda/_${eventId}?html=true`,
  });

  // Agenda PDF
  pdfs.push({
    type: 'Agenda',
    label: 'Agenda (PDF)',
    url: `${baseUrl}/AgendaCenter/ViewFile/Agenda/_${eventId}`,
  });

  // Agenda Packet (combined PDF)
  pdfs.push({
    type: 'Packet',
    label: 'Packet (PDF)',
    url: `${baseUrl}/AgendaCenter/ViewFile/Agenda/_${eventId}?packet=true`,
  });

  // Minutes
  if (minutesUrl) {
    pdfs.push({
      type: 'Minutes',
      label: 'Minutes (PDF)',
      url: minutesUrl,
    });
  } else {
    pdfs.push({
      type: 'Minutes',
      label: 'Minutes (PDF)',
      url: `${baseUrl}/AgendaCenter/ViewFile/Minutes/_${eventId}`,
    });
  }

  return pdfs;
}