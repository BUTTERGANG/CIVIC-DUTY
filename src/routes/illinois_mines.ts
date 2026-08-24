// src/routes/illinois_mines.ts
// Illinois mining data: permit boundaries, mine shafts, aggregate mines.

import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

const TABLES: Record<string, string> = {
  permits:   'illinois_mine_permits',
  shafts:    'illinois_mine_shafts',
  aggregate: 'illinois_aggregate_mines',
};

// Columns each table supports free-text `q` search on
const SEARCH_COLS: Record<string, string[]> = {
  permits:   ['mine_name', 'permittee', 'national_id'],
  shafts:    ['county', 'type_label'],
  aggregate: ['operator', 'mine_name', 'contact_city'],
};

// GET /api/illinois-mines/:type?limit=&offset=&q=
router.get('/:type', async (req, res) => {
  try {
    const table = TABLES[req.params.type];
    if (!table) {
      return res.status(404).json({ error: `Unknown type "${req.params.type}". Use: ${Object.keys(TABLES).join(', ')}` });
    }
    const limit = clampLimit(req.query.limit);
    const offset = clampOffset(req.query.offset);
    const params: any[] = [];

    let query = `SELECT * FROM ${table} WHERE 1=1`;
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      const p = `$${params.length}`;
      const cols = SEARCH_COLS[req.params.type] ?? [];
      query += ` AND (${cols.map(c => `${c} ILIKE ${p}`).join(' OR ')})`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      query += ` AND status ILIKE $${params.length}`;
    }
    if (req.query.county) {
      params.push(req.query.county);
      query += ` AND county ILIKE $${params.length}`;
    }
    if (req.query.lat && req.query.lng && req.query.radius_miles) {
      const lat = parseFloat(req.query.lat as string);
      const lng = parseFloat(req.query.lng as string);
      const miles = parseFloat(req.query.radius_miles as string);
      params.push(lat, lng, miles);
      query += ` AND (6371 * acos(least(1, greatest(-1,
        cos(radians($${params.length - 2})) * cos(radians(lat)) * cos(radians(lng) - radians($${params.length - 1}))
        + sin(radians($${params.length - 2})) * sin(radians(lat))))) * 0.621371 <= $${params.length}`;
    }

    query += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const results = await pool.query(query, params);
    res.json(results.rows);
  } catch (err) {
    sendError(res, err, 'IllinoisMines');
  }
});

// GET /api/illinois-mines/:type/:id — single record
router.get('/:type/:id', async (req, res) => {
  try {
    const table = TABLES[req.params.type];
    if (!table) return res.status(404).json({ error: 'Not found' });
    const result = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'IllinoisMines');
  }
});

export default router;
