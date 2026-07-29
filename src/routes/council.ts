import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, tags, from, to, q, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM council_votes WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (from) {
      params.push(from);
      query += ` AND date >= $${params.length}`;
    }
    if (to) {
      params.push(to);
      query += ` AND date <= $${params.length}`;
    }
    if (tags) {
      params.push(tags);
      query += ` AND $${params.length} = ANY(tags)`;
    }
    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      const i = params.length;
      query += ` AND (title ILIKE $${i} OR summary ILIKE $${i} OR agenda_items::text ILIKE $${i})`;
    }

    query += ' ORDER BY date DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'Council');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM council_votes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Council');
  }
});

export default router;
