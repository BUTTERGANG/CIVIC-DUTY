// src/routes/alerts.ts
import { Router } from 'express';
import { pool } from '../db';
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/alerts/rules  — create a watchlist rule for the authenticated user
router.post('/rules', async (req, res) => {
  try {
    const { city, module, keyword, lat, lng, radius_miles } = req.body;

    const result = await pool.query(
      `INSERT INTO alert_rules (user_id, city, module, keyword, radius_miles, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [String(req.user!.userId), city ?? 'fishers', module, keyword ?? null, radius_miles ?? null, lat ?? null, lng ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
