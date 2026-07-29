// src/routes/crashes.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, crash_type, severity, district, from, to, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM crashes WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (crash_type) {
      params.push(crash_type);
      query += ` AND crash_type = $${params.length}`;
    }
    if (severity) {
      params.push(severity);
      query += ` AND severity = $${params.length}`;
    }
    if (district) {
      params.push(district);
      query += ` AND district = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND occurred_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND occurred_at <= $${params.length}`;
    }

    query += ' ORDER BY occurred_at DESC NULLS LAST';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'Crashes');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM crashes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Crashes');
  }
});

export default router;
