// src/server.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { setupScheduler } from './scheduler';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

app.listen(PORT, () => {
  console.log(`[Server] Civic Data Aggregator API running on http://localhost:${PORT}`);
  setupScheduler();
});
