// src/routes/tax_districts.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, district_code, district_name, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM tax_districts WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (district_code) {
      params.push(district_code);
      query += ` AND district_code = $${params.length}`;
    }
    if (district_name) {
      params.push(`%${district_name}%`);
      query += ` AND district_name ILIKE $${params.length}`;
    }

    query += ` ORDER BY district_code ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const results = await pool.query(query, params);
    res.json(results.rows);
  } catch (err) {
    sendError(res, err, 'TaxDistricts');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tax_districts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'TaxDistricts');
  }
});

export default router;
