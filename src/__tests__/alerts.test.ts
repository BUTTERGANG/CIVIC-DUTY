// src/__tests__/alerts.test.ts
// Rule matching for the watchlist/alerts engine. Pure logic, no DB.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ruleMatches } from '../alerts/engine';

describe('keyword rules', () => {
  const rule = { id: 1, user_id: 1, module: 'council', keyword: 'rezoning' };

  test('matches a keyword anywhere in the record', () => {
    assert.equal(ruleMatches(rule, { title: 'Ordinance 12 — Rezoning of 96th St' }), true);
  });

  test('is case-insensitive in both directions', () => {
    assert.equal(ruleMatches({ ...rule, keyword: 'REZONING' }, { title: 'rezoning' }), true);
    assert.equal(ruleMatches(rule, { title: 'REZONING' }), true);
  });

  test('searches nested fields, not just the top level', () => {
    // Records are JSON.stringify'd, so agenda items and party lists count.
    assert.equal(
      ruleMatches(rule, { title: 'Council Meeting', agenda_items: [{ title: 'Rezoning request' }] }),
      true
    );
  });

  test('does not match an unrelated record', () => {
    assert.equal(ruleMatches(rule, { title: 'Budget Amendment' }), false);
  });

  test('a rule with no keyword and no geo never matches', () => {
    assert.equal(ruleMatches({ id: 2, user_id: 1, module: 'council' }, { title: 'anything' }), false);
  });
});

describe('geo rules', () => {
  // Fishers city hall, 2 mile radius.
  const rule = { id: 3, user_id: 1, module: 'zoning', lat: 39.9568, lng: -86.0128, radius_miles: 2 };

  test('matches a record inside the radius', () => {
    assert.equal(ruleMatches(rule, { lat: 39.96, lng: -86.02 }), true);
  });

  test('does not match a record outside the radius', () => {
    // Downtown Indianapolis, ~12 miles away.
    assert.equal(ruleMatches(rule, { lat: 39.7684, lng: -86.1581 }), false);
  });

  test('does not match when the record has no coordinates', () => {
    // Incidents and use-of-force publish no lat/lng at all.
    assert.equal(ruleMatches(rule, { title: 'No geometry here' }), false);
    assert.equal(ruleMatches(rule, { lat: null, lng: null }), false);
  });
});

describe('combined rules', () => {
  const rule = {
    id: 4,
    user_id: 1,
    module: 'zoning',
    keyword: 'variance',
    lat: 39.9568,
    lng: -86.0128,
    radius_miles: 2,
  };

  test('either condition alone is enough to fire', () => {
    // Keyword hit, far away.
    assert.equal(ruleMatches(rule, { title: 'Variance request', lat: 39.7684, lng: -86.1581 }), true);
    // Geo hit, no keyword.
    assert.equal(ruleMatches(rule, { title: 'Sign permit', lat: 39.96, lng: -86.02 }), true);
  });

  test('neither condition means no alert', () => {
    assert.equal(ruleMatches(rule, { title: 'Sign permit', lat: 39.7684, lng: -86.1581 }), false);
  });
});
