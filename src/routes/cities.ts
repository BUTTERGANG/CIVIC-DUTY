// src/routes/cities.ts
import { Router } from 'express';
import { pool } from '../db';
import { sendError } from '../lib/http';

const router = Router();

// City metadata — defines display names, available modules, and descriptions
const CITY_META: Record<string, {
  displayName: string;
  state: string;
  description: string;
  modules: string[];
  icon: string;
}> = {
  fishers: {
    displayName: 'Fishers',
    state: 'IN',
    description: 'City of Fishers — council votes, bids, zoning, campaign finance, court cases.',
    modules: ['council', 'bids', 'zoning', 'campaign', 'court'],
    icon: '🏛️',
  },
  zionsville: {
    displayName: 'Zionsville',
    state: 'IN',
    description: 'Town of Zionsville — Town Council meetings, agendas, and minutes.',
    modules: ['council'],
    icon: '🏘️',
  },
  indy: {
    displayName: 'Indianapolis',
    state: 'IN',
    description: 'City of Indianapolis — council votes, public safety, crashes, citations, use of force, 311 requests.',
    modules: ['council', 'incidents', 'crashes', 'citations', 'useOfForce', 'serviceRequests'],
    icon: '🌆',
  },
};

// GET /api/cities — list all available cities with metadata and live counts
router.get('/', async (_req, res) => {
  try {
    // Get distinct cities from all data tables
    const [councilCities, bidCities, incidentCities] = await Promise.all([
      pool.query('SELECT DISTINCT city FROM council_votes WHERE city IS NOT NULL'),
      pool.query('SELECT DISTINCT city FROM bids WHERE city IS NOT NULL'),
      pool.query('SELECT DISTINCT city FROM incidents WHERE city IS NOT NULL'),
    ]);

    const activeCities = new Set([
      ...councilCities.rows.map(r => r.city),
      ...bidCities.rows.map(r => r.city),
      ...incidentCities.rows.map(r => r.city),
    ]);

    // Always include configured cities even if no data yet
    const allCities = new Set([...Object.keys(CITY_META), ...activeCities]);

    const cities = Array.from(allCities).map(id => ({
      id,
      ...CITY_META[id] ?? {
        displayName: id,
        state: 'IN',
        description: `${id} data.`,
        modules: [],
        icon: '📍',
      },
      hasData: activeCities.has(id),
    }));

    res.json({ cities });
  } catch (err) {
    sendError(res, err, 'Cities');
  }
});

// GET /api/cities/:id — get metadata for a specific city
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const meta = CITY_META[id];

    if (!meta) {
      res.status(404).json({ error: `Unknown city: ${id}` });
      return;
    }

    // Get live counts for this city
    const [councilCount, bidsCount, incidentsCount] = await Promise.all([
      pool.query('SELECT count(*) FROM council_votes WHERE city = $1', [id]),
      pool.query('SELECT count(*) FROM bids WHERE city = $1', [id]),
      pool.query('SELECT count(*) FROM incidents WHERE city = $1', [id]),
    ]);

    res.json({
      id,
      ...meta,
      counts: {
        council: parseInt(councilCount.rows[0].count, 10),
        bids: parseInt(bidsCount.rows[0].count, 10),
        incidents: parseInt(incidentsCount.rows[0].count, 10),
      },
    });
  } catch (err) {
    sendError(res, err, 'Cities');
  }
});

export default router;
