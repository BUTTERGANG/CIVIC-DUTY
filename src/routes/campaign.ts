// src/routes/campaign.ts
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, candidate, cycle, donor_type, donor_name, office, min_amount, max_amount, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM campaign_contributions WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (candidate) {
      params.push(`%${candidate}%`);
      query += ` AND candidate ILIKE $${params.length}`;
    }
    if (cycle) {
      params.push(cycle);
      query += ` AND cycle = $${params.length}`;
    }
    if (donor_type) {
      params.push(donor_type);
      query += ` AND donor_type = $${params.length}`;
    }
    if (donor_name) {
      params.push(`%${donor_name}%`);
      query += ` AND donor_name ILIKE $${params.length}`;
    }
    if (office) {
      params.push(`%${office}%`);
      query += ` AND office ILIKE $${params.length}`;
    }
    if (min_amount) {
      params.push(min_amount);
      query += ` AND amount >= $${params.length}`;
    }
    if (max_amount) {
      params.push(max_amount);
      query += ` AND amount <= $${params.length}`;
    }

    query += ' ORDER BY filed_date DESC';
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

router.get('/candidates', async (req, res) => {
  try {
    const { city } = req.query;
    let query = 'SELECT DISTINCT candidate FROM campaign_contributions';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` WHERE city = $${params.length}`;
    }
    query += ' ORDER BY candidate ASC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => r.candidate));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/offices', async (req, res) => {
  try {
    const { city } = req.query;
    let query = `SELECT DISTINCT office FROM campaign_contributions WHERE office IS NOT NULL AND office != ''`;
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    query += ' ORDER BY office ASC';

    const result = await pool.query(query, params);
    res.json(result.rows.map(r => r.office));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
