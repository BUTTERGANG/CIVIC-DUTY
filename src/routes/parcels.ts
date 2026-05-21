// src/routes/parcels.ts
import { Router } from 'express';
import { pool } from '../db';
import { calculateDistance } from '../scrapers/utils';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, address, owner, land_use, zoning, lat, lng, radius_miles, limit = 50, offset = 0 } = req.query;
    let query = 'SELECT * FROM parcels WHERE 1=1';
    const params: any[] = [];

    if (city) {
      params.push(city);
      query += ` AND city = $${params.length}`;
    }
    if (address) {
      params.push(`%${address}%`);
      query += ` AND address ILIKE $${params.length}`;
    }
    if (owner) {
      params.push(`%${owner}%`);
      query += ` AND owner_name ILIKE $${params.length}`;
    }
    if (land_use) {
      params.push(`%${land_use}%`);
      query += ` AND land_use ILIKE $${params.length}`;
    }
    if (zoning) {
      params.push(zoning);
      query += ` AND zoning = $${params.length}`;
    }

    query += ` ORDER BY parcel_id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM parcels WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
