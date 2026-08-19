// src/routes/daycares.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, q, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM daycares WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (q) { params.push(`%${q}%`); query += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`; }

    query += ' ORDER BY name ASC';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'Daycares');
  }
});

export default router;