// src/routes/parcel_owners.ts
import { Router } from 'express';
import { pool } from '../db';
import { clampLimit, clampOffset, sendError } from '../lib/http';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { city, owner_name, q, property_class, parcel_number, limit: rawLimit, offset: rawOffset } = req.query;
    const limit = clampLimit(rawLimit);
    const offset = clampOffset(rawOffset);
    let query = 'SELECT * FROM parcel_owners WHERE 1=1';
    const params: any[] = [];

    if (city) { params.push(city); query += ` AND city = $${params.length}`; }
    if (owner_name) { params.push(`%${owner_name}%`); query += ` AND owner_name ILIKE $${params.length}`; }
    if (q) { params.push(`%${q}%`); query += ` AND (owner_name ILIKE $${params.length} OR owner_address ILIKE $${params.length} OR state_parcel_number ILIKE $${params.length})`; }
    if (property_class) { params.push(property_class); query += ` AND property_class = $${params.length}`; }
    if (parcel_number) { params.push(`%${parcel_number}%`); query += ` AND state_parcel_number ILIKE $${params.length}`; }

    query += ' ORDER BY owner_name ASC';
    params.push(limit); query += ` LIMIT $${params.length}`;
    params.push(offset); query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    sendError(res, err, 'ParcelOwners');
  }
});

export default router;