// src/middleware/rateLimit.ts
// Rate limiters for the endpoints where an unthrottled caller costs us real
// resources — CPU, memory, or our standing with an upstream data source.
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

/**
 * Credential endpoints. bcrypt at 12 rounds makes each attempt expensive for
 * the server as well as the attacker, so this caps both brute-forcing and the
 * CPU cost of a login flood. Successful logins don't count against the quota.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

/**
 * MyCase lookups. Each miss launches a headless Chromium and drives traffic
 * at Indiana's court site from our IP — the expensive path in the whole app,
 * and the one most likely to get us blocked upstream. Deliberately tight.
 */
export const courtLookupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Per-user, not per-IP: the route requires auth, and several users behind
  // one NAT shouldn't share a quota.
  keyGenerator: (req) =>
    req.user?.userId ? String(req.user.userId) : ipKeyGenerator(req.ip ?? ''),
  message: { error: 'Lookup limit reached (20/hour). Try again later.' },
});

/**
 * Baseline for the public read API. Generous enough for normal dashboard use,
 * low enough to blunt a scraper pointed at our own endpoints.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});
