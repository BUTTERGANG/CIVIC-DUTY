# Multi-stage build for CIVIC-DUTY
# Stage 1: build backend (tsc) + frontend (vite)
# Stage 2: lean production image

# ---- Builder ----
FROM node:22-bookworm AS builder

WORKDIR /app

# Backend deps + build
COPY package.json package-lock.json* ./
RUN npm install --no-fund --no-audit

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Frontend deps + build
COPY CIVIC-DUTY-UI/package.json CIVIC-DUTY-UI/package-lock.json* ./CIVIC-DUTY-UI/
RUN cd CIVIC-DUTY-UI && npm install --no-fund --no-audit

COPY CIVIC-DUTY-UI/ ./CIVIC-DUTY-UI/
RUN cd CIVIC-DUTY-UI && npm run build

# ---- Production ----
FROM node:22-bookworm-slim AS production

WORKDIR /app

# Copy backend runtime deps + compiled code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy frontend build output
COPY --from=builder /app/CIVIC-DUTY-UI/dist ./CIVIC-DUTY-UI/dist

# Copy database schema for init
COPY src/db/schema.sql ./src/db/schema.sql

ENV PORT=3333
ENV NODE_ENV=production

EXPOSE 3333

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sf http://localhost:3333/health || exit 1

CMD ["node", "dist/server.js"]
