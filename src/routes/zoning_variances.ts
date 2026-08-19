// src/routes/zoning_variances.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, case_number, status, planner, from, to, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM zoning_variances WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (case_number) { params.push(`%${case_number}%`); query += ` AND case_number ILIKE $${params.length}`; }
    if (status) { params.push(status); query += ` AND status = $${params.length}`; }
    if (planner) { params.push(`%${planner}%`); query += ` AND planner ILIKE $${params.length}`; }
    if (from) { params.push(from); query += ` AND decision_date >= $${params.length}`; }
    if (to) { params.push(to); query += ` AND decision_date <= $${params.length}`; }

    query += ' ORDER BY decision_date DESC NULLS LAST';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'ZoningVariances');
  }
});

export default router;