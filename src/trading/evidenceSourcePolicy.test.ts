import test from 'node:test';
import assert from 'node:assert/strict';
import { assetSearchTerms, googleNewsRssUrl, publisherReliabilityPrior } from './evidenceSourcePolicy';

test('publisher priors are language-agnostic operational policy', () => {
  assert.equal(publisherReliabilityPrior('Reuters'), 0.90);
  assert.equal(publisherReliabilityPrior('연합뉴스'), 0.84);
  assert.equal(publisherReliabilityPrior('Unknown Blog'), 0);
});

test('asset search terms support English and Korean without changing market identity', () => {
  assert.ok(assetSearchTerms('KRW-BTC', 'EN').includes('bitcoin'));
  assert.ok(assetSearchTerms('KRW-BTC', 'KO').includes('비트코인'));
  assert.ok(assetSearchTerms('KRW-XRP', 'KO').includes('리플'));
});

test('Google News RSS locale follows requested evidence language', () => {
  const en = googleNewsRssUrl('KRW-ETH', 'EN');
  const ko = googleNewsRssUrl('KRW-ETH', 'KO');
  assert.match(en, /hl=en-US/);
  assert.match(ko, /hl=ko/);
  assert.match(ko, /ceid=KR:ko/);
});
