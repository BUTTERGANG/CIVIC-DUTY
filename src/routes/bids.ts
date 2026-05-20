// src/routes/bids.ts
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, status, category, agency, min_value, max_value, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM bids WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }
    if (agency) {
      params.push(agency);
      query += ` AND agency = $${params.length}`;
    }
    if (min_value) {
      params.push(min_value);
      query += ` AND value_estimate >= $${params.length}`;
    }
    if (max_value) {
      params.push(max_value);
      query += ` AND value_estimate <= $${params.length}`;
    }

    query += ' ORDER BY posted_date DESC NULLS LAST';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bids WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
