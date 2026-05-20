// src/scrapers/court.ts
// On-demand MyCase lookup for a single case number or party name.
// Bulk scraping is not viable due to CAPTCHA risk; this is called
// from the POST /api/court/lookup route only.

import { withBrowser, Scraper } from './utils';
import { pool } from '../db';

const MYCASE_URL = 'https://public.courts.in.gov/mycase/#/vw/Search';

export interface CourtCaseRecord {
  case_number: string;
  title: string;
  case_type: string | null;
  status: string | null;
  parties: { name: string; role: string }[];
  next_hearing: string | null;
  judge: string | null;
  filed_date: string | null;
}

/**
 * Look up a single case by case number on MyCase.
 * Returns null if not found or if the page fails to load.
 */
export async function lookupCaseByNumber(caseNumber: string): Promise<CourtCaseRecord | null> {
  return withBrowser(async (page) => {
    await page.goto(MYCASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Click the "Case Number" tab if it exists
    const caseNumTab = await page.$('[role="tab"]:has-text("Case Number"), button:has-text("Case Number"), a:has-text("Case Number")');
    if (caseNumTab) {
      await caseNumTab.click();
      await page.waitForTimeout(1000);
    }

    // Fill in the case number input
    const input = await page.$('input[id*="case" i][id*="num" i], input[placeholder*="case number" i], input[name*="caseNumber" i]');
    if (!input) {
      console.warn('[CourtScraper] Could not find case number input');
      return null;
    }
    await input.fill(caseNumber.trim());

    // Submit
    const submitBtn = await page.$('button[type="submit"], button:has-text("Search"), input[type="submit"]');
    if (!submitBtn) {
      console.warn('[CourtScraper] Could not find submit button');
      return null;
    }
    await submitBtn.click();
    await page.waitForTimeout(5000);

    // Try to parse the result — MyCase shows a results table or a detail panel
    const result = await page.evaluate((cn) => {
      // Look for a row matching our case number in a results table
      const rows = Array.from(document.querySelectorAll('table tbody tr, [class*="result"] [class*="row"], [class*="case-row"]'));
      for (const row of rows) {
        const text = row.textContent ?? '';
        if (text.includes(cn)) {
          const cells = Array.from(row.querySelectorAll('td, [class*="cell"]')).map(c => c.textContent?.trim() ?? '');
          return { type: 'row', cells, fullText: text.replace(/\s+/g, ' ').trim() };
        }
      }
      // Fallback: grab page text and see if there's case detail
      const bodyText = document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000);
      return { type: 'body', bodyText };
    }, caseNumber);

    if (result.type === 'row' && result.cells && result.cells.length > 0) {
      // Heuristic parsing: case number is usually first, title/parties follow
      return {
        case_number: caseNumber,
        title: result.cells[1] ?? result.cells[0] ?? 'Unknown',
        case_type: result.cells[2] ?? null,
        status: result.cells[result.cells.length - 1] ?? null,
        parties: [],
        next_hearing: null,
        judge: null,
        filed_date: null,
      };
    }

    if (result.type === 'body' && result.bodyText) {
      // Check if any result mentioning our case number appeared
      if (result.bodyText.includes(caseNumber)) {
        return {
          case_number: caseNumber,
          title: `Case ${caseNumber}`,
          case_type: null,
          status: 'found',
          parties: [],
          next_hearing: null,
          judge: null,
          filed_date: null,
        };
      }
    }

    return null;
  });
}

/**
 * Persist a looked-up case to the DB (upsert on case_number).
 * Returns the saved row's id.
 */
export async function saveCaseRecord(rec: CourtCaseRecord): Promise<number> {
  const result = await pool.query(
    `INSERT INTO court_cases (case_number, title, case_type, status, parties, next_hearing, judge, filed_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (case_number) DO UPDATE SET
       title        = EXCLUDED.title,
       status       = EXCLUDED.status,
       parties      = EXCLUDED.parties,
       next_hearing = EXCLUDED.next_hearing,
       judge        = EXCLUDED.judge
     RETURNING id`,
    [
      rec.case_number,
      rec.title,
      rec.case_type,
      rec.status,
      JSON.stringify(rec.parties),
      rec.next_hearing,
      rec.judge,
      rec.filed_date,
    ]
  );
  return result.rows[0].id;
}

// The scheduled scraper is a no-op — court data is on-demand only
export class CourtScraper implements Scraper {
  module = 'court';
  async run() {
    console.log('[CourtScraper] Skipped — court data is on-demand only (use POST /api/court/lookup)');
  }
}
