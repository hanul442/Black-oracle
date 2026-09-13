import assert from 'node:assert/strict';
import test from 'node:test';
import { delayedResearchProvenance, evaluateMarketDataSuitability } from './marketDataProvider';
import { parseYahooChartPayload, yahooSymbolsForKrx } from './equity/yahooKrxMarketData';

test('delayed fallback is allowed for research but never for intraday execution', () => {
  const provenance = delayedResearchProvenance('YAHOO_FINANCE', '005930.KS', 1_000_000, 1_100_000, 20);
  const execution = evaluateMarketDataSuitability(provenance, 'EXECUTION_INTRADAY');
  const research = evaluateMarketDataSuitability(provenance, 'RESEARCH_INTRADAY');

  assert.equal(provenance.quality, 'DELAYED');
  assert.equal(provenance.executionEligible, false);
  assert.equal(provenance.researchOnly, true);
  assert.equal(execution.allowed, false);
  assert.equal(research.allowed, true);
  assert.match(execution.reason, /not permitted/i);
});

test('Yahoo KRX symbol resolution tries KOSPI then KOSDAQ without guessing execution authority', () => {
  assert.deepEqual(yahooSymbolsForKrx('005930'), ['005930.KS', '005930.KQ']);
  assert.throws(() => yahooSymbolsForKrx('5930'), /six-digit/i);
});

test('Yahoo chart parser preserves source timestamps and filters invalid OHLCV rows', () => {
  const payload = {
    chart: {
      error: null,
      result: [{
        meta: { symbol: '005930.KS' },
        timestamp: [1_700_000_000, 1_700_000_300, 1_700_000_600],
        indicators: {
          quote: [{
            open: [70_000, null, 70_500],
            high: [70_500, null, 71_000],
            low: [69_800, null, 70_400],
            close: [70_300, null, 70_900],
            volume: [100_000, null, 120_000],
          }],
        },
      }],
    },
  };

  const parsed = parseYahooChartPayload(payload, 'KRX-005930', 5);
  assert.equal(parsed.yahooSymbol, '005930.KS');
  assert.equal(parsed.candles.length, 2);
  assert.equal(parsed.candles[0]?.timestamp, 1_700_000_000_000);
  assert.equal(parsed.candles[1]?.close, 70_900);
  assert.equal(parsed.candles[1]?.volume, 120_000);
});
