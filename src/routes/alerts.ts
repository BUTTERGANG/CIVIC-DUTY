// src/routes/alerts.ts
import { Router } from 'express';
import { pool } from '../db';
import { sendError } from '../lib/http';
import { requireAuth } from '../middleware/auth';

const router = Router();

// All alert routes require a valid JWT
router.use(requireAuth);

// GET /api/alerts  — returns alerts for the authenticated user
router.get('/', async (req, res) => {
  try {
    const { city, read, module } = req.query;
    let query = 'SELECT * FROM alerts WHERE user_id = $1';
    const params: any[] = [String(req.user!.userId)];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (read !== undefined) {
      params.push(read === 'true');
      query += ` AND read = $${params.length}`;
    }
    if (module) {
      params.push(module);
      query += ` AND module = $${params.length}`;
    }

    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

// GET /api/alerts/rules  — list the authenticated user's watchlist rules
router.get('/rules', async (req, res) => {
  try {
    const { city } = req.query;
    let query = 'SELECT * FROM alert_rules WHERE user_id = $1';
    const params: any[] = [String(req.user!.userId)];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

// POST /api/alerts/rules  — create a watchlist rule for the authenticated user
router.post('/rules', async (req, res) => {
  try {
    const { city, module, keyword, lat, lng, radius_miles, email_enabled } = req.body;

    const result = await pool.query(
      `INSERT INTO alert_rules (user_id, city, module, keyword, radius_miles, lat, lng, email_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [String(req.user!.userId), city ?? 'fishers', module, keyword ?? null, radius_miles ?? null, lat ?? null, lng ?? null, email_enabled !== undefined ? email_enabled : true]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

// PATCH /api/alerts/rules/:id  — update a watchlist rule (must be owner)
router.patch('/rules/:id', async (req, res) => {
  try {
    const { email_enabled } = req.body;

    // Only allow toggling email_enabled for now; extend as needed
    const result = await pool.query(
      'UPDATE alert_rules SET email_enabled = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [email_enabled, req.params.id, String(req.user!.userId)]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Rule not found or not yours' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

// DELETE /api/alerts/rules/:id  — remove a watchlist rule (must be owner)
router.delete('/rules/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM alert_rules WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, String(req.user!.userId)]
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: 'Rule not found or not yours' });
      return;
    }
    res.json({ deleted: true });
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

// PATCH /api/alerts/:id/read  — mark an alert as read (must be owner)
router.patch('/:id/read', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE alerts SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, String(req.user!.userId)]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Alert not found or not yours' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Alerts');
  }
});

export default router;
