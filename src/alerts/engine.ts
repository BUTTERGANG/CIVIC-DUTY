// src/alerts/engine.ts
import { pool } from '../db';
import { calculateDistance } from '../scrapers/utils';
import { sendAlertEmail } from '../email';

/** Does one record trip one rule? Pure — no I/O, so it's directly testable. */
export function ruleMatches(rule: any, record: any): boolean {
  // Keyword match (title, description, parties etc.)
  if (rule.keyword) {
    const searchString = JSON.stringify(record).toLowerCase();
    if (searchString.includes(rule.keyword.toLowerCase())) return true;
  }

  // Geo match (address_radius_miles)
  if (rule.radius_miles && rule.lat && rule.lng && record.lat && record.lng) {
    const dist = calculateDistance(rule.lat, rule.lng, record.lat, record.lng);
    if (dist <= rule.radius_miles) return true;
  }

  return false;
}

/**
 * Evaluate a batch of new records against a module's alert rules.
 *
 * Batched deliberately: the rules are fetched once for the whole batch rather
 * than once per record. The campaign scraper ingests 27 years of statewide
 * contributions in a run, and a per-record rules query there meant hundreds of
 * thousands of round-trips.
 */
export async function runAlertEngineBatch(module: string, records: any[]) {
  if (records.length === 0) return;

  try {
    const rulesRes = await pool.query('SELECT * FROM alert_rules WHERE module = $1', [module]);
    const rules = rulesRes.rows;
    if (rules.length === 0) return;

    const matches: any[] = [];
    // Keep rule + record alongside matches for email delivery (not persisted)
    const matchedPairs: { rule: any; record: any }[] = [];

    for (const record of records) {
      for (const rule of rules) {
        if (!ruleMatches(rule, record)) continue;
        matches.push({
          user_id: rule.user_id,
          module: module,
          message: `New ${module} record matched your alert rule ${rule.id}`,
          item_id: record.id ?? null,
        });
        matchedPairs.push({ rule, record });
      }
    }

    if (matches.length > 0) {
      const query = `
        INSERT INTO alerts (user_id, module, message, item_id)
        SELECT
          (m.data ->> 'user_id')::INT,
          m.data ->> 'module',
          m.data ->> 'message',
          (m.data ->> 'item_id')::INT
        FROM
          jsonb_to_recordset($1::jsonb) AS m(data jsonb)
      `;
      const values = [JSON.stringify(matches)];
      await pool.query(query, values);
      console.log(`[AlertEngine] Inserted ${matches.length} new alerts for module ${module}`);

      // Fire-and-forget email delivery for rules with email_enabled
      for (const { rule, record } of matchedPairs) {
        if (rule.email_enabled !== false) {
          // Non-blocking: do not await — email failures must never break the alert engine
          deliverAlertEmail(rule.user_id, module, rule, record).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('[AlertEngine] Error pushing alerts:', err);
  }
}

/** Single-record convenience wrapper for the low-volume scrapers. */
export async function runAlertEngine(module: string, record: any) {
  return runAlertEngineBatch(module, [record]);
}

/**
 * Look up the user's email and send an alert notification.
 * Intentionally isolated so failures cannot propagate to the engine.
 */
async function deliverAlertEmail(userId: string, module: string, rule: any, record: any) {
  try {
    const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0 || !userRes.rows[0].email) return;

    const email = userRes.rows[0].email;
    const itemTitle = record.title || record.name || record.address || `#${record.id}`;
    const itemUrl = `${process.env.APP_URL || 'https://civicduty.app'}/${module}/${record.id}`;

    await sendAlertEmail(email, {
      module,
      keyword: rule.keyword || '(geo rule)',
      itemTitle,
      itemUrl,
    });
  } catch (err: any) {
    console.error('[AlertEngine] Email delivery failed:', err.message);
  }
}
