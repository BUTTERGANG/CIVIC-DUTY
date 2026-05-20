// src/routes/court.ts
import { Router } from 'express';
import { pool } from '../db';
import { lookupCaseByNumber, saveCaseRecord } from '../scrapers/court';

const router = Router();

// GET /api/court  — list cached cases
router.get('/', async (req, res) => {
  try {
    const { city, case_type, status, party, from, to, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM court_cases WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (case_type) { params.push(case_type); query += ` AND case_type = $${params.length}`; }
    if (status)    { params.push(status);    query += ` AND status = $${params.length}`; }
    if (from)      { params.push(from);      query += ` AND filed_date >= $${params.length}`; }
    if (to)        { params.push(to);        query += ` AND filed_date <= $${params.length}`; }
    if (party)     { params.push(`%${party}%`); query += ` AND parties::text ILIKE $${params.length}`; }

    // Get total count for pagination
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)::int AS cnt');
    const countRes = await pool.query(countQuery, params);
    const total = countRes.rows[0]?.cnt ?? 0;

    query += ' ORDER BY scraped_at DESC';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json({ total, rows: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/court/lookup  — on-demand case number lookup via MyCase
router.post('/lookup', async (req, res) => {
  const { case_number } = req.body;
  if (!case_number?.trim()) {
    res.status(400).json({ error: 'case_number is required' });
    return;
  }

  const cn = case_number.trim().toUpperCase();

  try {
    const cached = await pool.query(
      'SELECT * FROM court_cases WHERE case_number = $1',
      [cn]
    );
    if (cached.rows.length > 0) {
      return res.json({ source: 'cache', case: cached.rows[0] });
    }

    console.log(`[Court] Looking up ${cn} on MyCase...`);
    const found = await lookupCaseByNumber(cn);

    if (!found) {
      return res.status(404).json({ error: `Case ${cn} not found on MyCase` });
    }

    const id = await saveCaseRecord(found);
    const saved = await pool.query('SELECT * FROM court_cases WHERE id = $1', [id]);
    res.json({ source: 'mycase', case: saved.rows[0] });
  } catch (err: any) {
    console.error('[Court] Lookup error:', err.message);
    res.status(500).json({ error: 'Lookup failed — MyCase may be unavailable' });
  }
});

// GET /api/court/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM court_cases WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
