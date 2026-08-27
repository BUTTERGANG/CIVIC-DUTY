// src/routes/campaign_expenditures.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { candidate, office, cycle, payee_name, min_amount, max_amount, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM campaign_expenditures WHERE 1=1';
    const params: any[] = [];

    if (candidate) {
      params.push(`%${candidate}%`);
      query += ` AND candidate_name ILIKE $${params.length}`;
    }
    if (office) {
      params.push(`%${office}%`);
      query += ` AND office_sought ILIKE $${params.length}`;
    }
    if (cycle) {
      params.push(cycle);
      query += ` AND cycle = $${params.length}`;
    }
    if (payee_name) {
      params.push(`%${payee_name}%`);
      query += ` AND payee_name ILIKE $${params.length}`;
    }
    if (min_amount) {
      params.push(min_amount);
      query += ` AND amount >= $${params.length}`;
    }
    if (max_amount) {
      params.push(max_amount);
      query += ` AND amount <= $${params.length}`;
    }

    query += ' ORDER BY expenditure_date DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;
    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'CampaignExpenditures');
  }
});

router.get('/candidates', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT candidate_name FROM campaign_expenditures WHERE candidate_name IS NOT NULL AND candidate_name != \'\' ORDER BY candidate_name ASC'
    );
    res.json(result.rows.map(r => r.candidate_name));
  } catch (err) {
    sendError(res, err, 'CampaignExpenditures');
  }
});

router.get('/offices', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT office_sought FROM campaign_expenditures WHERE office_sought IS NOT NULL AND office_sought != '' ORDER BY office_sought ASC`
    );
    res.json(result.rows.map(r => r.office_sought));
  } catch (err) {
    sendError(res, err, 'CampaignExpenditures');
  }
});

export default router;