// src/alerts/engine.ts
import { pool } from '../db';
import { calculateDistance } from '../scrapers/utils';

export async function runAlertEngine(module: string, record: any) {
  try {
    // Fetch all alert rules for the module
    const rulesRes = await pool.query('SELECT * FROM alert_rules WHERE module = $1', [module]);
    const rules = rulesRes.rows;
    const matches: any[] = [];

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
          item_id: record.id
        });
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
    }
  } catch (err) {
    console.error('[AlertEngine] Error pushing alerts:', err);
  }
}
