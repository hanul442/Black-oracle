import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDiverseEvidenceCandidates } from './evidenceCandidateSelection';

type Item = { market: string; sourceUrl: string; title: string; source: string };

const item = (market: string, source: string, index: number): Item => ({
  market,
  source,
  title: `${source} ${market} ${index}`,
  sourceUrl: `https://example.com/${source}/${market}/${index}`,
});

test('broad official feeds cannot starve market-specific news inside a 36-candidate budget', () => {
  const markets = ['KRW-BTC', 'KRW-ETH', 'KRW-XRP', 'KRW-SOL', 'KRW-NEAR', 'KRW-LPT'];
  const groups = [
    { id: 'ethereum', items: [item('KRW-ETH', 'ethereum', 1), item('KRW-ETH', 'ethereum', 2)] },
    { id: 'fsc', items: markets.flatMap((market) => [1, 2, 3].map((index) => item(market, 'fsc', index))) },
    { id: 'bok', items: markets.flatMap((market) => [1, 2].map((index) => item(market, 'bok', index))) },
    { id: 'coindesk', items: markets.flatMap((market) => [1, 2].map((index) => item(market, 'coindesk', index))) },
    { id: 'gnews-ko', items: markets.flatMap((market) => [1, 2].map((index) => item(market, 'gnews-ko', index))) },
    { id: 'gnews-en', items: markets.flatMap((market) => [1, 2].map((index) => item(market, 'gnews-en', index))) },
  ];

  const selected = selectDiverseEvidenceCandidates(markets, groups, 36);
  assert.equal(selected.length, 36);

  for (const market of markets) {
    const marketItems = selected.filter((candidate) => candidate.market === market);
    for (const source of ['fsc', 'bok', 'coindesk', 'gnews-ko', 'gnews-en']) {
      assert.ok(marketItems.some((candidate) => candidate.source === source), `${market} missing ${source}`);
    }
  }
  assert.ok(selected.some((candidate) => candidate.market === 'KRW-ETH' && candidate.source === 'ethereum'));
});

test('selection is deterministic, deduplicated and respects capacity', () => {
  const markets = ['KRW-BTC', 'KRW-ETH'];
  const duplicate = item('KRW-BTC', 'fsc', 1);
  const groups = [
    { id: 'fsc', items: [duplicate, { ...duplicate }, item('KRW-ETH', 'fsc', 1)] },
    { id: 'news', items: [item('KRW-BTC', 'news', 1), item('KRW-ETH', 'news', 1)] },
  ];

  const first = selectDiverseEvidenceCandidates(markets, groups, 3);
  const second = selectDiverseEvidenceCandidates(markets, groups, 3);

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.equal(new Set(first.map((candidate) => `${candidate.market}|${candidate.sourceUrl}|${candidate.title}`)).size, first.length);
});

test('zero or negative capacity returns no candidates', () => {
  const groups = [{ id: 'news', items: [item('KRW-BTC', 'news', 1)] }];
  assert.deepEqual(selectDiverseEvidenceCandidates(['KRW-BTC'], groups, 0), []);
  assert.deepEqual(selectDiverseEvidenceCandidates(['KRW-BTC'], groups, -5), []);
});
