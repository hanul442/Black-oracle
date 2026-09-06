import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalizeUrl, clampTier, looksBreaking, normalizeTitle } from '../src/normalize.ts';

test('normalizes Korean alert prefixes and whitespace', () => {
  assert.equal(normalizeTitle(' [속보]  한국은행   기준금리 발표 '), '한국은행 기준금리 발표');
});

test('canonicalizes tracking params and fragments', () => {
  assert.equal(
    canonicalizeUrl('https://example.com/news/?utm_source=x&b=2&a=1#top'),
    'https://example.com/news?a=1&b=2',
  );
});

test('detects breaking labels', () => {
  assert.equal(looksBreaking('[BREAKING] Fed cuts rates'), true);
  assert.equal(looksBreaking('Fed cuts rates'), false);
});

test('clamps source tier', () => {
  assert.equal(clampTier(-3), 0);
  assert.equal(clampTier(8), 5);
  assert.equal(clampTier(undefined), 2);
});
