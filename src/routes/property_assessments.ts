// src/routes/property_assessments.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, parcel_number, owner_name, address, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM property_assessments WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (parcel_number) { params.push(`%${parcel_number}%`); query += ` AND parcel_number ILIKE $${params.length}`; }
    if (owner_name) { params.push(`%${owner_name}%`); query += ` AND owner_name ILIKE $${params.length}`; }
    if (address) { params.push(`%${address}%`); query += ` AND address ILIKE $${params.length}`; }

    query += ' ORDER BY parcel_number ASC';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'PropertyAssessments');
  }
});

export default router;