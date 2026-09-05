import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedEvidenceUrl } from './webEvidenceReader';

test('trusted evidence URL policy accepts official and allowlisted HTTPS sources', () => {
  assert.equal(isTrustedEvidenceUrl('https://github.com/bitcoin/bitcoin/releases'), true);
  assert.equal(isTrustedEvidenceUrl('https://blog.ethereum.org/2026/09/01/example'), true);
  assert.equal(isTrustedEvidenceUrl('https://www.reuters.com/markets/example'), true);
  assert.equal(isTrustedEvidenceUrl('https://news.google.com/rss/articles/example'), true);
});

test('trusted evidence URL policy rejects unsafe schemes, credentials and unrelated hosts', () => {
  assert.equal(isTrustedEvidenceUrl('http://github.com/bitcoin/bitcoin'), false);
  assert.equal(isTrustedEvidenceUrl('https://user:pass@github.com/bitcoin/bitcoin'), false);
  assert.equal(isTrustedEvidenceUrl('https://127.0.0.1/internal'), false);
  assert.equal(isTrustedEvidenceUrl('https://localhost/admin'), false);
  assert.equal(isTrustedEvidenceUrl('https://github.com.evil.example/bitcoin'), false);
  assert.equal(isTrustedEvidenceUrl('https://example.com/article'), false);
});
