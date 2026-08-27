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

// ---------------------------------------------------------------------------
// Party-name lookup helpers
// ---------------------------------------------------------------------------

/** Result row returned from a MyCase party-name search results table. */
interface MyCaseResultRow {
  case_number: string;
  case_type: string | null;
  status: string | null;
  parties: string[];
  case_title: string;
}

/**
 * Parse a MyCase search-results table into structured rows.
 * Runs in-page via page.evaluate.
 */
function parseResultsTable(): MyCaseResultRow[] {
  // MyCase renders results in a table inside .search-results or [class*="results"]
  const rows: MyCaseResultRow[] = [];
  const tableRows = document.querySelectorAll('table tbody tr, [class*="result"] [class*="row"], [class*="case-row"], [class*="search-results"] [class*="row"]');
  for (const row of tableRows) {
    const cells = Array.from(row.querySelectorAll('td, [class*="cell"], [class*="col-"]'));
    if (cells.length < 2) continue;
    const cellTexts = cells.map(c => c.textContent?.trim() ?? '');

    // Try to extract a case number from the first or second cell
    let caseNumber = '';
    let caseType: string | null = null;
    let status: string | null = null;
    const parties: string[] = [];
    let caseTitle = '';

    for (const text of cellTexts) {
      // Look for pattern like 29D01-2501-PL-000123
      const cnMatch = text.match(/\b\d{2}[A-Z]\d{2}-\d{4}-[A-Z]{1,3}-\d+\b/i);
      if (cnMatch) {
        caseNumber = cnMatch[0].toUpperCase();
        break;
      }
    }

    if (!caseNumber) continue;

    // Assign remaining cells heuristically
    if (cellTexts.length >= 2) caseTitle = cellTexts[1] !== caseNumber ? cellTexts[1] : (cellTexts[2] ?? '');
    if (cellTexts.length >= 3) caseType = cellTexts[2] !== caseTitle ? cellTexts[2] : null;
    if (cellTexts.length >= 1) status = cellTexts[cellTexts.length - 1];

    rows.push({ case_number: caseNumber, case_type: caseType, status, parties, case_title: caseTitle });
  }

  // Fallback: look for any div/span that contains a case-number-like pattern
  if (rows.length === 0) {
    const allText = document.body.innerText;
    const cnRegex = /\b(\d{2}[A-Z]\d{2}-\d{4}-[A-Z]{1,3}-\d+)\b/gi;
    let match;
    const seen = new Set<string>();
    while ((match = cnRegex.exec(allText)) !== null) {
      const cn = match[1].toUpperCase();
      if (!seen.has(cn)) {
        seen.add(cn);
        rows.push({ case_number: cn, case_type: null, status: 'found', parties: [], case_title: `Case ${cn}` });
      }
    }
  }

  return rows;
}

/**
 * Search for cases by party name on MyCase.
 * Returns up to `maxResults` matching cases (default 20 per page).
 */
export async function lookupCasesByPartyName(
  partyName: string,
  maxResults: number = 20
): Promise<{ cases: CourtCaseRecord[]; hasMore: boolean }> {
  return withBrowser(async (page) => {
    await page.goto(MYCASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // --- Click the "Name" tab ---
    const nameTab = await page.$(
      '[role="tab"]:has-text("Name"), button:has-text("Name"), a:has-text("Name")'
    );
    if (nameTab) {
      await nameTab.click();
      await page.waitForTimeout(1500);
    } else {
      console.warn('[CourtScraper] Could not find Name tab — trying fallback');
    }

    // --- Fill in the party name input ---
    // MyCase shows different input fields under the Name tab:
    // typically "Last Name/Business" and "First Name" or a combined field
    const nameInput =
      (await page.$('input[id*="last" i][id*="name" i], input[placeholder*="last name" i], input[placeholder*="business" i], input[name*="lastName" i], input[name*="surname" i]')) ??
      (await page.$('input[id*="name" i]:not([id*="case" i]), input[placeholder*="name" i]')) ??
      (await page.$('[role="tabpanel"][class*="active"] input[type="text"], [role="tabpanel"]:not([hidden]) input[type="text"]'));
    if (!nameInput) {
      console.warn('[CourtScraper] Could not find party name input on Name tab');
      return { cases: [], hasMore: false };
    }

    await nameInput.fill(partyName.trim());

    // --- Submit the search ---
    const submitBtn =
      (await page.$('button[type="submit"]')) ??
      (await page.$('button:has-text("Search")')) ??
      (await page.$('input[type="submit"]'));
    if (!submitBtn) {
      console.warn('[CourtScraper] Could not find submit button');
      return { cases: [], hasMore: false };
    }
    await submitBtn.click();
    await page.waitForTimeout(5000);

    // --- Parse results (with pagination support) ---
    const allCases: CourtCaseRecord[] = [];
    let hasMore = false;

    for (let pageNum = 0; pageNum < 10; pageNum++) {
      const parsed = await page.evaluate(parseResultsTable);

      for (const row of parsed) {
        if (allCases.length >= maxResults) {
          hasMore = true;
          break;
        }
        allCases.push({
          case_number: row.case_number,
          title: row.case_title,
          case_type: row.case_type,
          status: row.status,
          parties: row.parties.map((p) => ({ name: p, role: 'Party' })),
          next_hearing: null,
          judge: null,
          filed_date: null,
        });
      }
      if (allCases.length >= maxResults) {
        hasMore = true;
        break;
      }

      // Try next page pagination — look for a "Next" or ">" link/button
      const nextBtn = await page.$(
        'a:has-text("Next"), button:has-text("Next"), a[rel="next"], [class*="pagination"] a:has-text(">"):not([aria-disabled]), li:not([class*="disabled"]) a:has-text(">"), button:has-text("Load More"), [class*="load-more"]'
      );
      if (!nextBtn) {
        break; // No more pages
      }

      const isDisabled = await nextBtn.evaluate((el) => {
        return (
          el.hasAttribute('disabled') ||
          el.getAttribute('aria-disabled') === 'true' ||
          el.classList.contains('disabled') ||
          el.parentElement?.classList.contains('disabled')
        );
      });
      if (isDisabled) break;

      await nextBtn.click();
      await page.waitForTimeout(3000);
    }

    return { cases: allCases, hasMore };
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