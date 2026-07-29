// src/routes/schools.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';
import { calculateDistance } from '../scrapers/utils';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, name, district, school_type, lat, lng, radius_miles, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM schools WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (name) {
      params.push(`%${name}%`);
      query += ` AND name ILIKE $${params.length}`;
    }
    if (district) {
      params.push(`%${district}%`);
      query += ` AND district ILIKE $${params.length}`;
    }
    if (school_type) {
      params.push(school_type);
      query += ` AND school_type = $${params.length}`;
    }

    query += ` ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const results = await pool.query(query, params);

    if (lat && lng && radius_miles) {
      const centerLat = parseFloat(lat as string);
      const centerLng = parseFloat(lng as string);
      const radiusMi = parseFloat(radius_miles as string);
      const filtered = results.rows.filter((row: any) => {
        if (row.lat == null || row.lng == null) return false;
        return calculateDistance(centerLat, centerLng, parseFloat(row.lat), parseFloat(row.lng)) <= radiusMi;
      });
      res.json(filtered);
      return;
    }

    res.json(results.rows);
  } catch (err) {
    sendError(res, err, 'Schools');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schools WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    sendError(res, err, 'Schools');
  }
});

export default router;
