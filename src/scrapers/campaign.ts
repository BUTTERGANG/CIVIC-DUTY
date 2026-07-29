// src/scrapers/campaign.ts
import https from 'https';
import { parse } from 'csv-parse';
import unzipper from 'unzipper';
import { Scraper } from './utils';
import { pool } from '../db';
import { runAlertEngineBatch } from '../alerts/engine';

const BASE_URL = 'https://campaignfinance.in.gov/PublicSite/Docs/BulkDataDownloads';
const START_YEAR = 2000;
const BATCH_SIZE = 500;

const CAMPAIGN_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/zip, application/octet-stream, */*',
  'Referer': 'https://campaignfinance.in.gov/PublicSite/Reporting/DataDownload.aspx',
};

interface ContribRow {
  FileNumber: string;
  CommitteeType: string;
  Committee: string;
  CandidateName: string;
  ContributorType: string;
  Name: string;
  Address: string;
  City: string;
  State: string;
  Zip: string;
  Occupation: string;
  Type: string;
  Description: string;
  Amount: string;
  ContributionDate: string;
  Received_By: string;
  Amended: string;
}

/**
 * Streams a ZIP from `url`, extracts the single CSV inside, and yields rows.
 * Returns 0 immediately if the server returns a non-200 (e.g. year doesn't exist yet).
 */
function streamCsvFromZip(
  url: string,
  onBatch: (rows: ContribRow[]) => Promise<void>
): Promise<number> {
  return new Promise((resolve, reject) => {
    let totalRows = 0;
    let batch: ContribRow[] = [];
    let pendingFlush: Promise<void> = Promise.resolve();

    const req = https.get(url, { headers: CAMPAIGN_HEADERS }, res => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(0);
      }

      const csvStream = res
        .pipe(unzipper.ParseOne())
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true, skip_records_with_error: true }));

      csvStream.on('data', (row: ContribRow) => {
        batch.push(row);
        totalRows++;

        if (batch.length >= BATCH_SIZE) {
          const toFlush = batch.splice(0, BATCH_SIZE);
          csvStream.pause();
          pendingFlush = pendingFlush
            .then(() => onBatch(toFlush))
            .then(() => { csvStream.resume(); })
            .catch(err => { csvStream.destroy(err); });
        }
      });

      csvStream.on('end', () => {
        pendingFlush
          .then(() => batch.length > 0 ? onBatch(batch) : Promise.resolve())
          .then(() => resolve(totalRows))
          .catch(reject);
      });

      csvStream.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(120_000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

async function insertBatch(
  rows: ContribRow[],
  year: number
): Promise<{ inserted: number; insertedRows: any[] }> {
  let inserted = 0;
  let insertedRows: any[] = [];

  // Build a multi-row VALUES clause for efficiency
  const values: any[] = [];
  const placeholders: string[] = [];

  for (const row of rows) {
    const candidate = row.CandidateName?.trim() || row.Committee?.trim() || 'Unknown';
    const donorName = row.Name?.trim() || null;
    const amount = parseFloat(row.Amount) || null;
    const rawDate = row.ContributionDate?.trim();
    const filedDate = rawDate ? rawDate.split(' ')[0] : null; // strip time portion

    if (!candidate || amount === null || !filedDate) continue;

    const base = values.length;
    values.push(
      candidate,
      row.Committee?.trim() || null,
      row.CommitteeType?.trim() || null,
      donorName,
      row.ContributorType?.trim() || null,
      amount,
      filedDate,
      String(year)
    );
    placeholders.push(
      `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8})`
    );
  }

  if (placeholders.length === 0) return { inserted: 0, insertedRows: [] };

  try {
    const res = await pool.query(
      `INSERT INTO campaign_contributions
         (candidate, committee, committee_type, donor_name, donor_type, amount, filed_date, cycle)
       VALUES ${placeholders.join(',')}
       ON CONFLICT (donor_name, candidate, amount, filed_date) DO NOTHING
       RETURNING *`,
      values
    );
    inserted = res.rowCount ?? 0;
    insertedRows = res.rows;
  } catch (err) {
    console.error('[CampaignScraper] Batch insert error:', err);
  }

  return { inserted, insertedRows };
}

export class CampaignScraper implements Scraper {
  module = 'campaign';

  async run() {
    console.log('[CampaignScraper] Starting Indiana FCPA contribution ingest (2000–present)...');

    // Ensure the extra columns exist before inserting
    await pool.query(`
      ALTER TABLE campaign_contributions ADD COLUMN IF NOT EXISTS committee TEXT;
      ALTER TABLE campaign_contributions ADD COLUMN IF NOT EXISTS committee_type TEXT;
    `).catch(() => {}); // ignore if already exists or permissions issue

    const currentYear = new Date().getFullYear();
    let totalInserted = 0;
    let totalRows = 0;

    for (let year = START_YEAR; year <= currentYear; year++) {
      const url = `${BASE_URL}/${year}_ContributionData.csv.zip`;
      let yearInserted = 0;
      let yearRows = 0;

      try {
        yearRows = await streamCsvFromZip(url, async batch => {
          const { inserted, insertedRows } = await insertBatch(batch, year);
          yearInserted += inserted;
          // Evaluate alert rules against every row we actually inserted, per
          // batch. Batching keeps this to one alert_rules query per batch
          // rather than one per contribution.
          await runAlertEngineBatch('campaign', insertedRows);
        });
      } catch (err) {
        console.error(`[CampaignScraper] Error on year ${year}:`, err);
        continue;
      }

      if (yearRows > 0) {
        console.log(`[CampaignScraper] ${year}: ${yearRows.toLocaleString()} rows → ${yearInserted.toLocaleString()} inserted`);
      }

      totalRows += yearRows;
      totalInserted += yearInserted;

      // Small pause between years to be polite to the server
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[CampaignScraper] Done. Total rows: ${totalRows.toLocaleString()} | Inserted: ${totalInserted.toLocaleString()}`);
  }
}
