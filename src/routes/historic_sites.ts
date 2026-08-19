// src/routes/historic_sites.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, district, rating, q, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM historic_sites WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (district) { params.push(district); query += ` AND district = $${params.length}`; }
    if (rating) { params.push(rating); query += ` AND rating = $${params.length}`; }
    if (q) { params.push(`%${q}%`); query += ` AND (name ILIKE $${params.length} OR address ILIKE $${params.length})`; }

    query += ' ORDER BY name ASC';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'HistoricSites');
  }
});

export default router;