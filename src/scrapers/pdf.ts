// src/scrapers/pdf.ts
// Downloads Minutes and Agenda PDFs from CivicClerk, extracts:
//   Minutes → summary, vote_counts
//   Agendas → agenda_items (ordinance/resolution numbers + titles)

import https from 'https';
import { PDFParse } from 'pdf-parse';
import { pool } from '../db';

const API_HEADERS = {
  Accept: 'application/json',
  Origin: 'https://fishersin.portal.civicclerk.com',
  Referer: 'https://fishersin.portal.civicclerk.com/',
};

// ── Fetch ─────────────────────────────────────────────────────────────────────

function fetchBuffer(url: string, retries = 3): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const attempt = (n: number) => {
      const req = https.get(url, { headers: API_HEADERS }, res => {
        if (res.statusCode === 429) {
          res.resume();
          if (n > 0) {
            const delay = Math.pow(2, 4 - n) * 1000; // 2s, 4s, 8s
            console.log(`[PDFScraper] 429 rate limited — retrying in ${delay}ms (${n} left)`);
            setTimeout(() => attempt(n - 1), delay);
          } else {
            reject(new Error(`HTTP 429 rate limited after retries: ${url}`));
          }
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      });
      req.on('error', err => {
        if (n > 0) {
          const delay = Math.pow(2, 4 - n) * 1000;
          console.log(`[PDFScraper] Network error — retrying in ${delay}ms: ${err.message}`);
          setTimeout(() => attempt(n - 1), delay);
        } else {
          reject(err);
        }
      });
      req.setTimeout(60_000, () => { req.destroy(); reject(new Error(`Timeout: ${url}`)); });
    };
    attempt(retries);
  });
}

// ── Vote count extraction (Task 9 — refined) ─────────────────────────────────

/**
 * Extract vote counts from minutes PDF text.
 * Tries patterns in order of specificity; returns first confident match.
 */
export function extractVoteCounts(text: string): { yes: number; no: number; abstain: number } | null {
  // Normalize: collapse whitespace, unify common separators
  const t = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ');

  // Pattern 1: "APPROVED 7-0", "PASSED 6-1", "FAILED 3-4"  (most common in Fishers minutes)
  const p1 = /(?:approved|passed|adopted|failed|denied|carried)\s+(\d+)\s*[-–]\s*(\d+)(?:\s*[-–]\s*(\d+))?/gi;
  const m1 = p1.exec(t);
  if (m1) {
    return { yes: +m1[1], no: +m1[2], abstain: +(m1[3] ?? 0) };
  }

  // Pattern 2: "Ayes: 7  Nays: 0  Abstain: 0"
  const ayesM = /\bAyes?\s*:?\s*(\d+)/i.exec(t);
  const naysM = /\bNays?\s*:?\s*(\d+)/i.exec(t);
  if (ayesM && naysM) {
    const abstainM = /\bAbstain(?:ed|s)?\s*:?\s*(\d+)/i.exec(t);
    return { yes: +ayesM[1], no: +naysM[1], abstain: abstainM ? +abstainM[1] : 0 };
  }

  // Pattern 3: "Yeas: 7 / Nays: 0"  (parliamentary variant)
  const yeasM = /\bYeas?\s*:?\s*(\d+)/i.exec(t);
  const nayM2 = /\bNays?\s*:?\s*(\d+)/i.exec(t);
  if (yeasM && nayM2) {
    return { yes: +yeasM[1], no: +nayM2[1], abstain: 0 };
  }

  // Pattern 4: "voted N to M" / "vote was N-M"
  const p4 = /\bvot(?:ed|e\s+was)\s+(\d+)\s+(?:to|[-–])\s+(\d+)/i.exec(t);
  if (p4) {
    return { yes: +p4[1], no: +p4[2], abstain: 0 };
  }

  // Pattern 5: standalone "X-Y" within 60 chars of a vote keyword
  const voteCtx = /(?:vote|motion|resolution|ordinance|approved|passed|adopted)[^.]{0,60}/gi;
  let ctxM: RegExpExecArray | null;
  while ((ctxM = voteCtx.exec(t)) !== null) {
    const seg = ctxM[0];
    const digits = /(\d+)\s*[-–]\s*(\d+)(?:\s*[-–]\s*(\d+))?/.exec(seg);
    if (digits) {
      const yes = +digits[1], no = +digits[2], abstain = +(digits[3] ?? 0);
      // Sanity check: scores must be plausible council sizes (1–15)
      if (yes <= 15 && no <= 15 && abstain <= 15 && (yes + no + abstain) > 0) {
        return { yes, no, abstain };
      }
    }
  }

  // Pattern 6: "unanimous" → treat as 7-0 (Fishers City Council has 7 members; Plan Commission has 9)
  if (/\bunanimous(?:ly)?\b/i.test(t)) {
    // Try to find how many members were present
    const presentM = /(\d+)\s+members?\s+(?:present|in attendance)/i.exec(t);
    const count = presentM ? +presentM[1] : 7;
    return { yes: count, no: 0, abstain: 0 };
  }

  return null;
}

// ── Agenda item extraction (Task 8) ──────────────────────────────────────────

export interface AgendaItem {
  label: string;           // "I", "A", "1.", "IV.B" etc.
  title: string;           // item text
  ordinance?: string;      // "Ordinance No. 2024-01"
  resolution?: string;     // "Resolution No. 2024-15"
}

/**
 * Parse agenda items from an Agenda PDF's text.
 * Handles Roman numerals, alpha sub-items, and numeric numbering.
 */
export function extractAgendaItems(text: string): AgendaItem[] {
  const items: AgendaItem[] = [];

  // Normalize line endings
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim()).filter(Boolean);

  // Boilerplate lines to skip
  const SKIP = /^(city of fishers|fishers|agenda|minutes|meeting|call to order|roll call|present|absent|pledge|invocation|public comment|adjourn|open|closed|executive session|notice|page \d)/i;

  // Identify agenda item lines by their leading label
  // Matches: "I.", "II.", "III." / "A.", "B." / "1.", "2." / "IV.A." compound labels
  const LABEL_RE = /^((?:[IVX]+|[A-Z]|\d+)(?:\.[A-Z\d]*)?)\.?\s+(.+)/;

  // Ordinance / Resolution extractors
  const ORD_RE  = /Ordinance\s+(?:No\.?\s*)?(\d{4}[-–]\d+)/i;
  const RES_RE  = /Resolution\s+(?:No\.?\s*)?(\d{4}[-–]\d+)/i;

  for (const line of lines) {
    if (SKIP.test(line)) continue;
    if (line.length < 5) continue;

    const m = LABEL_RE.exec(line);
    if (!m) continue;

    const label = m[1];
    const title = m[2].trim();

    // Skip common non-item labels like single Roman numerals used as section headers
    // Keep only items that look substantive (≥10 chars or contain ordinance/resolution refs)
    if (title.length < 10 && !ORD_RE.test(title) && !RES_RE.test(title)) continue;

    const item: AgendaItem = { label, title };

    const ordM = ORD_RE.exec(title);
    if (ordM) item.ordinance = `Ordinance No. ${ordM[1]}`;

    const resM = RES_RE.exec(title);
    if (resM) item.resolution = `Resolution No. ${resM[1]}`;

    items.push(item);
  }

  return items.slice(0, 50); // cap at 50 items per meeting
}

/**
 * Produce a short summary from the first substantive paragraph of a minutes PDF.
 */
export function extractSummary(text: string): string {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 30)
    .filter(l => !/^(city of|fishers|meeting|call to order|roll call|present:|absent:|location|date:|time:)/i.test(l));

  return lines.slice(0, 3).join(' ').slice(0, 500).trim();
}

// ── Minutes processor ─────────────────────────────────────────────────────────

export async function processMinutesPdfs(concurrency = 1): Promise<void> {
  console.log('[PDFScraper] Fetching council_votes rows with unparsed Minutes...');

  const { rows } = await pool.query<{
    id: number;
    event_id: string;
    title: string;
    attached_pdfs: { fileId: number; type: string; label: string; url: string }[];
  }>(`
    SELECT id, event_id, title, attached_pdfs
    FROM council_votes
    WHERE summary IS NULL
      AND attached_pdfs IS NOT NULL
      AND attached_pdfs::text LIKE '%Minutes%'
    ORDER BY date ASC
  `);

  console.log(`[PDFScraper] ${rows.length} minutes rows to process`);
  let processed = 0, failed = 0;

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(batch.map(async row => {
      const file = row.attached_pdfs.find(f => f.type === 'Minutes');
      if (!file) return;
      try {
        const buffer = await fetchBuffer(file.url);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText({ first: 5 });
        const text = result.text;

        await pool.query(
          `UPDATE council_votes SET summary = $1, vote_counts = $2, scraped_at = NOW() WHERE id = $3`,
          [extractSummary(text) || null, JSON.stringify(extractVoteCounts(text)) ?? null, row.id]
        );
        processed++;
        if (processed % 10 === 0) console.log(`[PDFScraper] Minutes: ${processed}/${rows.length}`);
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        failed++;
        console.error(`[PDFScraper] Minutes failed on ${row.event_id}:`, (err as Error).message);
      }
    }));
  }

  console.log(`[PDFScraper] Minutes done. Processed: ${processed} | Failed: ${failed}`);
}

// ── Agenda processor (Task 8) ─────────────────────────────────────────────────

export async function processAgendaPdfs(concurrency = 1): Promise<void> {
  console.log('[PDFScraper] Fetching council_votes rows with unparsed Agendas...');

  const { rows } = await pool.query<{
    id: number;
    event_id: string;
    title: string;
    attached_pdfs: { fileId: number; type: string; label: string; url: string }[];
  }>(`
    SELECT id, event_id, title, attached_pdfs
    FROM council_votes
    WHERE agenda_items IS NULL
      AND attached_pdfs IS NOT NULL
      AND attached_pdfs::text LIKE '%Agenda%'
      AND attached_pdfs::text NOT LIKE '%Agenda Packet%'
    ORDER BY date ASC
  `);

  console.log(`[PDFScraper] ${rows.length} agenda rows to process`);
  let processed = 0, failed = 0;

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(batch.map(async row => {
      // Prefer the plain "Agenda" PDF; fall back to any agenda-type file
      const file =
        row.attached_pdfs.find(f => f.type === 'Agenda') ??
        row.attached_pdfs.find(f => /agenda/i.test(f.type) && !/packet/i.test(f.type));
      if (!file) return;

      try {
        const buffer = await fetchBuffer(file.url);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        const items = extractAgendaItems(result.text);

        await pool.query(
          `UPDATE council_votes SET agenda_items = $1, scraped_at = NOW() WHERE id = $2`,
          [items.length > 0 ? JSON.stringify(items) : JSON.stringify([]), row.id]
        );
        processed++;
        if (processed % 10 === 0) console.log(`[PDFScraper] Agendas: ${processed}/${rows.length}`);
        await new Promise(r => setTimeout(r, 1500));
      } catch (err) {
        failed++;
        console.error(`[PDFScraper] Agenda failed on ${row.event_id}:`, (err as Error).message);
      }
    }));
  }

  console.log(`[PDFScraper] Agendas done. Processed: ${processed} | Failed: ${failed}`);
}

// ── JSON fetch for CivicClerk API ────────────────────────────────────────────

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

// ── Per-agenda-item attachment types ──────────────────────────────────────────

interface PerItemAttachment {
  id: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  isPublished: boolean;
  pdfVersionFullPath: string;      // SAS URL (time-limited)
  mediaFullPath: string;           // blob container path without SAS
  mediaFileName?: string;          // media file name
}

interface MeetingItem {
  agendaObjectItemNumber: string;
  agendaObjectItemOutlineNumber: string;
  agendaObjectItemName: string;
  resolutionFormattedNumber?: string;
  ordinanceFormattedNumber?: string;
  attachmentsList: PerItemAttachment[];
  childItems: MeetingItem[];
  isSection: number;
}

// ── Collect all attachments from a meeting item tree ──────────────────────────

function collectItemAttachments(items: MeetingItem[]): {
  outlineNumber: string;
  name: string;
  resolution: string;
  ordinance: string;
  attachments: PerItemAttachment[];
}[] {
  const results: {
    outlineNumber: string;
    name: string;
    resolution: string;
    ordinance: string;
    attachments: PerItemAttachment[];
  }[] = [];

  for (const item of items) {
    const outline = item.agendaObjectItemOutlineNumber || '';
    const name = item.agendaObjectItemName || '';
    const resolution = item.resolutionFormattedNumber || '';
    const ordinance = item.ordinanceFormattedNumber || '';

    // Collect attachments at this level
    const atts = (item.attachmentsList || []).filter(a =>
      a.isPublished !== false && a.contentType === 'application/pdf'
    );

    if (atts.length > 0) {
      results.push({
        outlineNumber: outline,
        name,
        resolution,
        ordinance,
        attachments: atts,
      });
    }

    // Recurse into children
    if (item.childItems && item.childItems.length > 0) {
      const childResults = collectItemAttachments(item.childItems);
      // Prepend parent outline to child outlines
      for (const cr of childResults) {
        cr.outlineNumber = outline ? `${outline}${cr.outlineNumber}` : cr.outlineNumber;
      }
      results.push(...childResults);
    }
  }

  return results;
}

// ── Per-agenda-item PDF processor ─────────────────────────────────────────────

const MEETING_API_BASE = 'https://fishersin.api.civicclerk.com/v1';

export async function processPerItemPdfs(concurrency = 1): Promise<void> {
  console.log('[PDFScraper] Fetching council_votes rows with unprocessed per-item attachments...');

  const { rows } = await pool.query<{
    id: number;
    event_id: string;
    meeting_id: number | null;
    title: string;
  }>(`
    SELECT id, event_id, meeting_id, title
    FROM council_votes
    WHERE item_attachments IS NULL
      AND meeting_id IS NOT NULL
    ORDER BY date ASC
  `);

  console.log(`[PDFScraper] ${rows.length} events with meeting_id to process`);
  let processed = 0, failed = 0, totalAttachments = 0;

  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(batch.map(async row => {
      try {
        // Step 1: Fetch meeting data from CivicClerk API
        const meetingUrl = `${MEETING_API_BASE}/Meetings/${row.meeting_id}`;
        const meeting = await fetchJson(meetingUrl);
        const items: MeetingItem[] = meeting.items || [];

        if (items.length === 0) {
          // No items — mark as empty so we don't retry
          await pool.query(
            `UPDATE council_votes SET item_attachments = '[]'::jsonb, scraped_at = NOW() WHERE id = $1`,
            [row.id]
          );
          processed++;
          return;
        }

        // Step 2: Collect all per-item attachments from the item tree
        const collected = collectItemAttachments(items);
        if (collected.length === 0) {
          await pool.query(
            `UPDATE council_votes SET item_attachments = '[]'::jsonb, scraped_at = NOW() WHERE id = $1`,
            [row.id]
          );
          processed++;
          return;
        }

        // Step 3: Download each attachment PDF and extract text
        const results: {
          outlineNumber: string;
          name: string;
          resolution: string;
          ordinance: string;
          attachmentId: number;
          fileName: string;
          pdfText: string;
          pdfUrl: string;
        }[] = [];

        for (const group of collected) {
          for (const att of group.attachments) {
            const pdfUrl = att.pdfVersionFullPath;
            if (!pdfUrl) continue;

            try {
              const buffer = await fetchBuffer(pdfUrl);
              const parser = new PDFParse({ data: buffer });
              const pdfResult = await parser.getText();
              const pdfText = pdfResult.text || '';

              results.push({
                outlineNumber: group.outlineNumber,
                name: group.name,
                resolution: group.resolution,
                ordinance: group.ordinance,
                attachmentId: att.id,
                fileName: att.fileName || att.mediaFileName || 'document.pdf',
                pdfText: pdfText.slice(0, 10000), // cap at 10K chars per attachment
                pdfUrl,
              });

              totalAttachments++;
            } catch (err) {
              // If PDF download/parse fails, still record what we have
              results.push({
                outlineNumber: group.outlineNumber,
                name: group.name,
                resolution: group.resolution,
                ordinance: group.ordinance,
                attachmentId: att.id,
                fileName: att.fileName || att.mediaFileName || 'document.pdf',
                pdfText: '',
                pdfUrl,
              });
            }

            // Rate limiting: 500ms between downloads per event
            await new Promise(r => setTimeout(r, 500));
          }
        }

        // Step 4: Store in DB
        await pool.query(
          `UPDATE council_votes SET item_attachments = $1, scraped_at = NOW() WHERE id = $2`,
          [JSON.stringify(results), row.id]
        );

        processed++;
        if (processed % 10 === 0) console.log(`[PDFScraper] Per-item: ${processed}/${rows.length}`);
      } catch (err) {
        failed++;
        console.error(`[PDFScraper] Per-item failed for event ${row.event_id}:`, (err as Error).message);
      }
    }));
  }

  console.log(`[PDFScraper] Per-item done. Processed: ${processed} | Failed: ${failed} | Attachments downloaded: ${totalAttachments}`);
}
