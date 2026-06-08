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
      parcelsCount, buildingsCount, schoolsCount, parksCount, pollingCount, taxDistrictsCount,
      latestCouncil, latestBid, latestZoning, latestCampaign, latestCourt
    ] = await Promise.all([
      pool.query(`SELECT count(*) FROM council_votes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM bids ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM zoning_changes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM campaign_contributions ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM court_cases ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM incidents ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM crashes ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM citations ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM use_of_force ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM service_requests ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM parcels ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM buildings ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM schools ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM parks ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM polling_locations ${cityFilter}`, cityParams),
      pool.query(`SELECT count(*) FROM tax_districts ${cityFilter}`, cityParams),
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
        parcels:   parseInt(parcelsCount.rows[0].count, 10),
        buildings: parseInt(buildingsCount.rows[0].count, 10),
        schools:   parseInt(schoolsCount.rows[0].count, 10),
        parks:     parseInt(parksCount.rows[0].count, 10),
        polling:   parseInt(pollingCount.rows[0].count, 10),
        tax_districts: parseInt(taxDistrictsCount.rows[0].count, 10),
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

router.get('/freshness', async (req, res) => {
  try {
    const { city } = req.query;
    const cityFilter = city ? 'WHERE source = ANY($1)' : '';
    const cityParams = city ? [[city]] : [];

    const result = await pool.query(
      `SELECT DISTINCT ON (source)
         source, run_at AS last_run_at, status, records_upserted, error_message
       FROM scraper_log
       ${cityFilter}
       ORDER BY source, run_at DESC`,
      cityParams
    );

    const rows = result.rows.map((row: any) => {
      const lastRun = row.last_run_at ? new Date(row.last_run_at) : null;
      const hoursSince = lastRun
        ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60)
        : Infinity;
      return {
        source: row.source,
        last_run_at: row.last_run_at,
        status: row.status,
        records_upserted: row.records_upserted,
        stale: hoursSince > 24 || row.status === 'error',
        error_message: row.error_message || null,
      };
    });

    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
