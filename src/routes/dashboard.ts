// src/routes/dashboard.ts
import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/summary', async (req, res) => {
  try {
    const { city } = req.query;
    const cityFilter = city ? 'WHERE city = $1' : '';
    const cityParams = city ? [city] : [];

    const [
      councilCount, bidsCount, zoningCount, campaignCount, courtCount,
      incidentsCount, crashesCount, citationsCount, uofCount, serviceCount,
      latestCouncil, latestBid, latestZoning, latestCampaign, latestCourt
    ] = await Promise.all([
      pool.query(`SELECT count(*) FROM council_votes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM bids ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM zoning_changes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM campaign_contributions ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM court_cases ${cityFilter}`, cityParams),
      // Indy-specific counts (only when no city filter or city=indy)
      pool.query(`SELECT count(*) FROM incidents ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM crashes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM citations ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM use_of_force ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM service_requests ${cityFilter}`, cityParams),
      pool.query(`SELECT * FROM council_votes ${cityFilter} ORDER BY scraped_at DESC LIMIT 1`, cityParams),
      pool.query(`SELECT * FROM bids ${cityFilter} ORDER BY scraped_at DESC LIMIT 1`, cityParams),
      pool.query(`SELECT * FROM zoning_changes ${cityFilter} ORDER BY scraped_at DESC LIMIT 1`, cityParams),
      pool.query(`SELECT * FROM campaign_contributions ${cityFilter} ORDER BY scraped_at DESC LIMIT 1`, cityParams),
      pool.query(`SELECT * FROM court_cases ${cityFilter} ORDER BY scraped_at DESC LIMIT 1`, cityParams),
    ]);

    res.json({
      counts: {
        council:   parseInt(councilCount.rows[0].count, 10),
        bids:      parseInt(bidsCount.rows[0].count, 10),
        zoning:    parseInt(zoningCount.rows[0].count, 10),
        campaign:  parseInt(campaignCount.rows[0].count, 10),
        court:     parseInt(courtCount.rows[0].count, 10),
        incidents: parseInt(incidentsCount.rows[0].count, 10),
        crashes:   parseInt(crashesCount.rows[0].count, 10),
        citations: parseInt(citationsCount.rows[0].count, 10),
        useOfForce: parseInt(uofCount.rows[0].count, 10),
        serviceRequests: parseInt(serviceCount.rows[0].count, 10),
      },
      latestItems: {
        council:   latestCouncil.rows[0] || null,
        bids:      latestBid.rows[0] || null,
        zoning:    latestZoning.rows[0] || null,
        campaign:  latestCampaign.rows[0] || null,
        court:     latestCourt.rows[0] || null,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
