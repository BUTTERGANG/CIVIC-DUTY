// src/routes/service_requests.ts
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, request_type, status, district, from, to, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM service_requests WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (request_type) {
      params.push(request_type);
      query += ` AND request_type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (district) {
      params.push(district);
      query += ` AND district = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND requested_at >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND requested_at <= $${params.length}`;
    }

    query += ' ORDER BY requested_at DESC NULLS LAST';
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
    const result = await pool.query('SELECT * FROM service_requests WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
