import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssetDecisionPolicy, inferAssetClassFromMarket } from './assetPolicy';
import { buildEvidenceCoverageRequest } from './evidenceCoverage';

test('crypto remains technical-first while dynamic KRX equities require evidence', () => {
  const crypto = getAssetDecisionPolicy('KRW-WLD');
  assert.equal(crypto.assetClass, 'CRYPTO_SPOT');
  assert.equal(crypto.evidenceRequiredForNewRisk, false);
  assert.equal(crypto.evidenceRequestOnGap, false);
  assert.ok(crypto.technicalWeight > crypto.evidenceWeight);

  const equity = getAssetDecisionPolicy('KRX-123456');
  assert.equal(inferAssetClassFromMarket('KRX-123456'), 'EQUITY');
  assert.equal(equity.assetClass, 'EQUITY');
  assert.equal(equity.evidenceRequiredForNewRisk, true);
  assert.equal(equity.evidenceRequestOnGap, true);
  assert.ok(equity.evidenceWeight > equity.technicalWeight);
});

test('dynamic equity coverage request preserves company aliases without execution authority', () => {
  const request = buildEvidenceCoverageRequest('KRX-123456', 1_700_000_000_000, {
    assetClass: 'EQUITY',
    aliases: ['테스트전자', 'Test Electronics', '123456'],
    trigger: 'ENTRY_CANDIDATE',
  });
  assert.equal(request.assetClass, 'EQUITY');
  assert.equal(request.executionAuthority, false);
  assert.ok(request.aliases.includes('테스트전자'));
  assert.ok(request.aliases.includes('Test Electronics'));
  assert.ok(request.aliases.includes('123456'));
  assert.ok(request.aliases.includes('KRX-123456'));
});
