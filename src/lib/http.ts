// src/lib/http.ts
// Shared request/response helpers for the API routes.
import { Response } from 'express';
import { randomUUID } from 'crypto';

/** Rows a single list request may return. Above this, use offset paging. */
export const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 50;

/**
 * Coerce a caller-supplied ?limit into a sane positive integer.
 * Without this, `?limit=99999999` against parcels (~400K rows) would try to
 * serialize the whole table.
 */
export function clampLimit(raw: unknown, max: number = MAX_LIMIT): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), max);
}

/** Coerce a caller-supplied ?offset into a non-negative integer. */
export function clampOffset(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.floor(n);
}

/**
 * Report a server-side failure without handing the caller our internals.
 * Postgres error text names tables, columns and constraints; that belongs in
 * the logs, not in a public response body. The returned ref lets a user quote
 * an id that we can grep for.
 */
export function sendError(res: Response, err: unknown, context: string): void {
  const ref = randomUUID().slice(0, 8);
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[${context}] (ref ${ref}) ${detail}`);
  res.status(500).json({ error: 'Internal server error', ref });
}
