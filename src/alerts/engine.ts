// src/alerts/engine.ts
import { pool } from '../db';
import { calculateDistance } from '../scrapers/utils';
import { sendAlertEmail } from '../email';

export async function runAlertEngine(module: string, record: any) {
  try {
    // Fetch all alert rules for the module
    const rulesRes = await pool.query('SELECT * FROM alert_rules WHERE module = $1', [module]);
    const rules = rulesRes.rows;
    const matches: any[] = [];
    // Keep rule metadata alongside matches for email delivery (not persisted)
    const matchedRules: any[] = [];

    for (const rule of rules) {
      let isMatch = false;

      // Keyword match (title, description, parties etc.)
      if (rule.keyword) {
        const searchString = JSON.stringify(record).toLowerCase();
        if (searchString.includes(rule.keyword.toLowerCase())) {
          isMatch = true;
        }
      }

      // Geo match (address_radius_miles)
      if (rule.radius_miles && rule.lat && rule.lng && record.lat && record.lng) {
        const dist = calculateDistance(rule.lat, rule.lng, record.lat, record.lng);
        if (dist <= rule.radius_miles) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matches.push({
          user_id: rule.user_id,
          module: module,
          message: `New ${module} record matched your alert rule ${rule.id}`,
          item_id: record.id,
        });
        matchedRules.push(rule);
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
      for (let i = 0; i < matchedRules.length; i++) {
        const rule = matchedRules[i];
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
