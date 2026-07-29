// src/__tests__/setup.js
// Preloaded before the test files (see the "test" script in package.json).
//
// src/config.ts hard-exits when DATABASE_URL or JWT_SECRET are missing, and
// importing almost anything reaches it via ../db. These are placeholders: the
// tests below exercise pure mapping/matching logic and never open a
// connection, so the values only need to exist, not to resolve.
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/civic_duty_test';
process.env.JWT_SECRET ??= 'test-only-secret-not-used-for-signing-anything-real';
process.env.ENABLE_SCHEDULER ??= 'false';
