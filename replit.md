# CivicDuty on Replit

## Run configuration

The project uses the existing TypeScript/Express backend to serve the built React/Vite dashboard from one origin. The `Start application` workflow should run:

```bash
npm run replit:dev
```

The Replit preview listens on port `5000`. The command builds `CIVIC-DUTY-UI` first, then starts the API server.

## Environment

- `DATABASE_URL` is supplied by Replit's managed PostgreSQL database.
- `SESSION_SECRET` is used for JWT signing when `JWT_SECRET` is not set.
- `ENABLE_SCHEDULER=false` is the safe preview default; enable the scheduler only on one always-on deployment.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` uses the Chromium package supplied by `replit.nix`.

Initialize or re-run the database schema with:

```bash
npm run db:init
```

For local development outside the combined Replit workflow, use `PORT=3333`, run `npm run dev` from the project root, and run the UI's Vite server from `CIVIC-DUTY-UI`.