// src/routes/cfs.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, incident_type, district, from, to, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM calls_for_service WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (incident_type) { params.push(incident_type); query += ` AND incident_type = $${params.length}`; }
    if (district) { params.push(district); query += ` AND district = $${params.length}`; }
    if (from) { params.push(from); query += ` AND received_at >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND received_at <= $${params.length}`; }

    query += ' ORDER BY received_at DESC NULLS LAST';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'CFS');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM calls_for_service WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'CFS');
  }
});

export default router;