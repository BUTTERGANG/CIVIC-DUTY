// src/__tests__/http.test.ts
// Pagination clamping. These bound what a single public request can pull out
// of tables that run to hundreds of thousands of rows (parcels ~400K).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { clampLimit, clampOffset, MAX_LIMIT } from '../lib/http';

describe('clampLimit', () => {
  test('passes through a reasonable value', () => {
    assert.equal(clampLimit('25'), 25);
    assert.equal(clampLimit(100), 100);
  });

  test('caps an absurd limit at MAX_LIMIT', () => {
    assert.equal(clampLimit('99999999'), MAX_LIMIT);
    assert.equal(clampLimit(Number.MAX_SAFE_INTEGER), MAX_LIMIT);
  });

  test('falls back to the default for junk, missing, or non-positive input', () => {
    assert.equal(clampLimit(undefined), 50);
    assert.equal(clampLimit(''), 50);
    assert.equal(clampLimit('abc'), 50);
    assert.equal(clampLimit('0'), 50);
    assert.equal(clampLimit('-5'), 50);
    assert.equal(clampLimit(NaN), 50);
    assert.equal(clampLimit(Infinity), 50);
  });

  test('truncates fractional limits to an integer', () => {
    // A non-integer would be rejected by Postgres as a LIMIT parameter.
    assert.equal(clampLimit('10.9'), 10);
    assert.equal(Number.isInteger(clampLimit('10.9')), true);
  });

  test('honours a stricter per-route cap', () => {
    assert.equal(clampLimit('1000', 100), 100);
  });
});

describe('clampOffset', () => {
  test('passes through a valid offset', () => {
    assert.equal(clampOffset('200'), 200);
  });

  test('floors junk, missing, and negative input to 0', () => {
    assert.equal(clampOffset(undefined), 0);
    assert.equal(clampOffset('abc'), 0);
    assert.equal(clampOffset('-10'), 0);
    assert.equal(clampOffset(NaN), 0);
  });

  test('truncates fractional offsets', () => {
    assert.equal(clampOffset('5.7'), 5);
  });
});

describe('sendError', () => {
  test('returns 500 with a ref and no leaked error message', () => {
    let statusCode = 0;
    let jsonBody: any = null;
    const mockRes = {
      status: (code: number) => {
        statusCode = code;
        return mockRes;
      },
      json: (body: any) => {
        jsonBody = body;
      },
    } as any;

    const { sendError } = require('../lib/http');
    sendError(mockRes, new Error('Sensitive SQL detail: users.password_hash wrong'), 'TestContext');

    assert.equal(statusCode, 500);
    assert.equal(jsonBody.error, 'Internal server error');
    assert.ok(typeof jsonBody.ref === 'string' && jsonBody.ref.length === 8, 'ref should be an 8-char hex string');
  });

  test('handles a non-Error thrown value', () => {
    let jsonBody: any = null;
    const mockRes = {
      status: () => mockRes,
      json: (body: any) => { jsonBody = body; },
    } as any;

    const { sendError } = require('../lib/http');
    sendError(mockRes, 'string error', 'TestContext');

    assert.equal(jsonBody.error, 'Internal server error');
    assert.ok(typeof jsonBody.ref === 'string');
  });

  test('handles null/undefined thrown value', () => {
    let jsonBody: any = null;
    const mockRes = {
      status: () => mockRes,
      json: (body: any) => { jsonBody = body; },
    } as any;

    const { sendError } = require('../lib/http');
    sendError(mockRes, null, 'TestContext');
    assert.equal(jsonBody.error, 'Internal server error');
  });
});
