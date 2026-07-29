// src/server.ts
import { config } from './config'; // must come first — loads .env, validates required vars
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { setupScheduler } from './scheduler';
import { apiLimiter } from './middleware/rateLimit';

// Routers
import councilRouter from './routes/council';
import bidsRouter from './routes/bids';
import zoningRouter from './routes/zoning';
import campaignRouter from './routes/campaign';
import courtRouter from './routes/court';
import alertsRouter from './routes/alerts';
import authRouter from './routes/auth';
import dashboardRouter from './routes/dashboard';
import citiesRouter from './routes/cities';
import incidentsRouter from './routes/incidents';
import crashesRouter from './routes/crashes';
import citationsRouter from './routes/citations';
import useOfForceRouter from './routes/use_of_force';
import serviceRequestsRouter from './routes/service_requests';
import parcelsRouter from './routes/parcels';
import buildingsRouter from './routes/buildings';
import schoolsRouter from './routes/schools';
import parksRouter from './routes/parks';
import pollingRouter from './routes/polling';
import taxDistrictsRouter from './routes/tax_districts';

const app = express();

// Replit, and most PaaS hosts, terminate TLS at a proxy. Without this every
// request appears to come from the proxy's IP and the rate limiters below
// would share one bucket across all callers.
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json({ limit: '100kb' }));

// Baseline limit for the whole API. Per-route limiters (auth, court lookup)
// are stricter and layer on top of this.
app.use('/api', apiLimiter);

// Mount routers
app.use('/api/council', councilRouter);
app.use('/api/bids', bidsRouter);
app.use('/api/zoning', zoningRouter);
app.use('/api/campaign', campaignRouter);
app.use('/api/court', courtRouter);
app.use('/api/auth', authRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/cities', citiesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/crashes', crashesRouter);
app.use('/api/citations', citationsRouter);
app.use('/api/use-of-force', useOfForceRouter);
app.use('/api/service-requests', serviceRequestsRouter);
app.use('/api/parcels', parcelsRouter);
app.use('/api/buildings', buildingsRouter);
app.use('/api/schools', schoolsRouter);
app.use('/api/parks', parksRouter);
app.use('/api/polling-locations', pollingRouter);
app.use('/api/tax-districts', taxDistrictsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// Serve the built frontend from the same origin as the API. The UI calls a
// relative '/api' base (CIVIC-DUTY-UI/src/api.ts), so no proxy or CORS config
// is needed once both are on one port — which is all Replit gives us.
// In dev the UI runs on Vite's own server and this block is simply skipped.
const hasUiBuild = fs.existsSync(path.join(config.uiDist, 'index.html'));
if (hasUiBuild) {
  app.use(express.static(config.uiDist));

  // SPA fallback: any non-/api GET that didn't match a file is a client-side
  // route, so hand back index.html and let React Router resolve it.
  app.get(/^(?!\/api\/|\/health$).*/, (req, res) => {
    res.sendFile(path.join(config.uiDist, 'index.html'));
  });
} else {
  console.warn(
    `[Server] No frontend build at ${config.uiDist} — serving API only. ` +
      `Run: cd CIVIC-DUTY-UI && npm run build`
  );
}

app.listen(config.port, () => {
  console.log(`[Server] Civic Data Aggregator listening on port ${config.port}`);
  console.log(`[Server] Frontend: ${hasUiBuild ? 'served from ' + config.uiDist : 'not built'}`);

  if (config.schedulerEnabled) {
    console.log('[Server] Scheduler enabled — registering cron jobs');
    setupScheduler();
  } else {
    console.log('[Server] Scheduler disabled (ENABLE_SCHEDULER=false)');
  }
});
