// src/scrapers/bids.ts
// Scrapes three bid sources:
//   1. Fishers city bids page (plain HTML, Playwright)
//   2. IDOA current business opportunities (JS-rendered table, Playwright, paginated)
//   3. IDOA upcoming anticipated solicitations (JS-rendered table, Playwright)

import { Scraper, withBrowser } from './utils';
import { pool } from '../db';
import { runAlertEngine } from '../alerts/engine';

// ── helpers ─────────────────────────────────────────────────────────────────

function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // "03/26/2026 4:00:00PM EST" → "2026-03-26"
  const m = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

async function upsertBid(item: {
  source: string;
  bid_id: string | null;
  title: string;
  agency: string | null;
  description: string | null;
  contact: string | null;
  posted_date: string | null;
  close_date: string | null;
  category: string | null;
  status: string;
  documents: string[];
}): Promise<boolean> {
  if (item.bid_id) {
    // Rows with a bid_id: conflict on (source, bid_id)
    const res = await pool.query(
      `INSERT INTO bids (source, bid_id, title, agency, description, contact, posted_date, close_date, category, status, documents)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (source, bid_id) DO UPDATE SET
         title       = EXCLUDED.title,
         agency      = EXCLUDED.agency,
         description = EXCLUDED.description,
         contact     = EXCLUDED.contact,
         close_date  = EXCLUDED.close_date,
         category    = EXCLUDED.category,
         status      = EXCLUDED.status,
         documents   = EXCLUDED.documents,
         scraped_at  = NOW()
       RETURNING id, (xmax = 0) AS is_insert`,
      [item.source, item.bid_id, item.title, item.agency, item.description,
       item.contact, item.posted_date, item.close_date, item.category, item.status, item.documents]
    );
    return res.rows[0]?.is_insert === true;
  } else {
    // Rows without a bid_id (Fishers, IDOA upcoming): conflict on partial index (source, title)
    const res = await pool.query(
      `INSERT INTO bids (source, bid_id, title, agency, description, contact, posted_date, close_date, category, status, documents)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (source, title) WHERE bid_id IS NULL DO UPDATE SET
         agency      = EXCLUDED.agency,
         description = EXCLUDED.description,
         contact     = EXCLUDED.contact,
         close_date  = EXCLUDED.close_date,
         category    = EXCLUDED.category,
         status      = EXCLUDED.status,
         documents   = EXCLUDED.documents,
         scraped_at  = NOW()
       RETURNING id, (xmax = 0) AS is_insert`,
      [item.source, item.title, item.agency, item.description,
       item.contact, item.posted_date, item.close_date, item.category, item.status, item.documents]
    );
    return res.rows[0]?.is_insert === true;
  }
}

// ── Source 1: Fishers city bids page ─────────────────────────────────────────

async function scrapeFishersBids(): Promise<number> {
  console.log('[BidsScraper] Fetching Fishers city bids...');
  let inserted = 0;

  await withBrowser(async page => {
    await page.goto('https://fishersin.gov/do-business-here/bids-proposals/', {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });
    await page.waitForTimeout(2000);

    // Extract bid items — one entry per unique PDF/doc link on the page.
    // For each anchor, grab the link text as the title and scan nearby sibling
    // text for a "Closing date:" value.
    const items = await page.evaluate(() => {
      const results: { title: string; closeDate: string | null; links: string[] }[] = [];
      const seenUrls = new Set<string>();

      const content = (document.querySelector('.entry-content, main, article, #content') ?? document.body) as HTMLElement;
      const anchors = Array.from(content.querySelectorAll('a[href]')) as HTMLAnchorElement[];

      for (const a of anchors) {
        if (!a.href.match(/\.(pdf|doc|docx|zip)/i)) continue;
        if (seenUrls.has(a.href)) continue;
        seenUrls.add(a.href);

        // Use the anchor text; fall back to filename from URL
        const rawText = a.innerText.trim();
        const filename = a.href.split('/').pop()?.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') ?? '';
        const title = rawText.length > 5 ? rawText : filename;
        if (!title || title.length < 4) continue;

        // Look for a "Closing date:" in the nearest parent block's text
        let closeDate: string | null = null;
        let el: HTMLElement | null = a.parentElement as HTMLElement | null;
        for (let depth = 0; depth < 5 && el; depth++, el = el.parentElement as HTMLElement | null) {
          const m = el.innerText.match(/clos(?:ing|e)\s*(?:date)?[:\s]+([^\n]+)/i);
          if (m) { closeDate = m[1].trim(); break; }
        }

        results.push({ title, closeDate, links: [a.href] });
      }

      return results;
    });

    for (const item of items) {
      if (!item.title || item.title.length < 6) continue;
      try {
        const isNew = await upsertBid({
          source: 'fishers',
          bid_id: null,
          title: item.title,
          agency: 'City of Fishers',
          description: null,
          contact: null,
          posted_date: null,
          close_date: parseDate(item.closeDate),
          category: null,
          status: 'open',
          documents: item.links,
        });
        if (isNew) {
          inserted++;
          await runAlertEngine('bids', { title: item.title, source: 'fishers' });
        }
      } catch (err) {
        console.error('[BidsScraper] Fishers upsert error:', err);
      }
    }
  });

  console.log(`[BidsScraper] Fishers: ${inserted} new bids`);
  return inserted;
}

// ── Source 2: IDOA current business opportunities ────────────────────────────

async function scrapeIdoaCurrent(): Promise<number> {
  console.log('[BidsScraper] Fetching IDOA current bids...');
  let inserted = 0;

  await withBrowser(async page => {
    await page.goto(
      'https://www.in.gov/idoa/procurement/current-business-opportunities/',
      { waitUntil: 'domcontentloaded', timeout: 45_000 }
    );
    await page.waitForTimeout(6000); // wait for MUI table to render

    let pageNum = 1;
    while (true) {
      console.log(`[BidsScraper] IDOA page ${pageNum}...`);

      const rows = await page.evaluate(() => {
        const results: {
          title: string;
          agency: string;
          eventId: string;
          description: string;
          closeDateRaw: string;
          contact: string;
          docUrl: string | null;
        }[] = [];

        const trs = Array.from(document.querySelectorAll('table tbody tr'));
        for (const tr of trs) {
          const tds = Array.from(tr.querySelectorAll('td'));
          if (tds.length < 5) continue;

          const titleCell = tds[0];
          const title = titleCell.querySelector('a')?.innerText.trim() ?? titleCell.innerText.trim();
          const agency = tds[1]?.innerText.trim() ?? '';
          const eventId = tds[2]?.innerText.trim() ?? '';
          const description = tds[3]?.innerText.trim() ?? '';
          const closeDateRaw = tds[4]?.innerText.trim() ?? '';
          const contact = tds[5]?.innerText.trim() ?? '';

          // Bid Documents link if present
          const docLink = titleCell.querySelector('a[href*="solicitations"]') as HTMLAnchorElement | null;
          const docUrl = docLink?.href ?? null;

          if (title) results.push({ title, agency, eventId, description, closeDateRaw, contact, docUrl });
        }
        return results;
      });

      for (const row of rows) {
        const docUrl = row.eventId
          ? `https://www.in.gov/idoa/proc/solicitations/files/${row.eventId}.zip`
          : row.docUrl;

        try {
          const isNew = await upsertBid({
            source: 'idoa',
            bid_id: row.eventId || null,
            title: row.title,
            agency: row.agency || null,
            description: row.description || null,
            contact: row.contact || null,
            posted_date: null,
            close_date: parseDate(row.closeDateRaw),
            category: null,
            status: 'open',
            documents: docUrl ? [docUrl] : [],
          });
          if (isNew) {
            inserted++;
            await runAlertEngine('bids', { title: row.title, source: 'idoa' });
          }
        } catch (err) {
          console.error('[BidsScraper] IDOA upsert error:', err);
        }
      }

      // Try to click Next button; stop if disabled or not found
      const nextBtn = page.locator('button[aria-label="Go to next page"], button:has-text("Next")').first();
      const isDisabled = await nextBtn.isDisabled().catch(() => true);
      if (isDisabled) break;

      await nextBtn.click();
      await page.waitForTimeout(3000);
      pageNum++;
    }
  });

  console.log(`[BidsScraper] IDOA current: ${inserted} new bids`);
  return inserted;
}

// ── Source 3: IDOA upcoming anticipated solicitations ────────────────────────

async function scrapeIdoaUpcoming(): Promise<number> {
  console.log('[BidsScraper] Fetching IDOA upcoming bids...');
  let inserted = 0;

  await withBrowser(async page => {
    await page.goto(
      'https://www.in.gov/idoa/procurement/current-business-opportunities/upcoming-anticipated-bidding-opportunities/',
      { waitUntil: 'domcontentloaded', timeout: 45_000 }
    );
    await page.waitForTimeout(6000);

    const rows = await page.evaluate(() => {
      const results: { eventType: string; title: string; description: string; agency: string }[] = [];
      const trs = Array.from(document.querySelectorAll('table tbody tr'));
      for (const tr of trs) {
        const tds = Array.from(tr.querySelectorAll('td'));
        if (tds.length < 3) continue;
        const eventType = tds[0]?.innerText.trim() ?? '';
        const title = tds[1]?.innerText.trim() ?? '';
        const description = tds[2]?.innerText.trim() ?? '';
        const agency = tds[3]?.innerText.trim() ?? '';
        if (title) results.push({ eventType, title, description, agency });
      }
      return results;
    });

    for (const row of rows) {
      try {
        const isNew = await upsertBid({
          source: 'idoa_upcoming',
          bid_id: null,
          title: row.title,
          agency: row.agency || null,
          description: row.description || null,
          contact: null,
          posted_date: null,
          close_date: null,
          category: row.eventType || null,
          status: 'anticipated',
          documents: [],
        });
        if (isNew) inserted++;
      } catch (err) {
        console.error('[BidsScraper] IDOA upcoming upsert error:', err);
      }
    }
  });

  console.log(`[BidsScraper] IDOA upcoming: ${inserted} new bids`);
  return inserted;
}

// ── Main scraper class ────────────────────────────────────────────────────────

export class BidsScraper implements Scraper {
  module = 'bids';

  async run() {
    console.log('[BidsScraper] Starting all bid sources...');

    // Add UNIQUE(source, title) constraint for bids without a bid_id (Fishers + IDOA upcoming)
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_source_title
        ON bids (source, title)
        WHERE bid_id IS NULL;
    `).catch(() => {}); // ignore if already exists

    const [f, i, u] = await Promise.allSettled([
      scrapeFishersBids(),
      scrapeIdoaCurrent(),
      scrapeIdoaUpcoming(),
    ]);

    const total =
      (f.status === 'fulfilled' ? f.value : 0) +
      (i.status === 'fulfilled' ? i.value : 0) +
      (u.status === 'fulfilled' ? u.value : 0);

    if (f.status === 'rejected') console.error('[BidsScraper] Fishers source failed:', f.reason);
    if (i.status === 'rejected') console.error('[BidsScraper] IDOA current failed:', i.reason);
    if (u.status === 'rejected') console.error('[BidsScraper] IDOA upcoming failed:', u.reason);

    console.log(`[BidsScraper] Done. Total new bids inserted: ${total}`);
  }
}
