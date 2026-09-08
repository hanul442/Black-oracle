import assert from 'node:assert/strict';
import { tradingEvidenceStore } from '../server/trading/evidenceStore';
import { paperLoopController } from '../server/trading/paperLoop';
import { paperTradingSession } from '../server/trading/paperSession';
import { researchFeatureStore } from '../server/trading/researchStore';

paperLoopController.stop();
paperTradingSession.reset(1_000_000);
tradingEvidenceStore.clear();
researchFeatureStore.reset();

// Use one candidate market to keep the live probe small. The universe builder
// still observes the current KRW liquidity set before selecting the candidate.
paperLoopController.start({
  intervalMs: 5 * 60 * 1000,
  maxMarkets: 1,
  maxOpenPositions: 1,
});
paperLoopController.stop();

const cycle = await paperLoopController.runCycle();
const state = paperTradingSession.state();
const research = researchFeatureStore.summary();

assert.ok(cycle.scanned >= 1, 'Live Paper sanity must scan at least one market.');
assert.equal(cycle.errors.length, 0, `Production cycle errors: ${JSON.stringify(cycle.errors)}`);
assert.equal(cycle.entered, 0, 'No structured Evidence must produce zero new entries.');
assert.ok(cycle.markets.every((item) => item.action !== 'ENTER'), 'No market may ENTER without Evidence.');
assert.ok(
  cycle.markets.every((item) => item.evidenceGate?.eligibleForNewRisk === false),
  'Every flat live candidate must be denied new-risk authority without Evidence.',
);
assert.ok(
  cycle.markets.every((item) => item.evidenceGate?.status === 'NO_DATA'),
  'Empty Evidence Store must surface NO_DATA on every live candidate.',
);

const buySubmissions = state.ledger.filter((event) =>
  event.type === 'ORDER_SUBMITTED' && String(event.payload.side ?? '').toUpperCase() === 'BUY',
);
assert.equal(buySubmissions.length, 0, 'Broker ledger must contain no BUY submission without Evidence.');

assert.equal(cycle.researchErrors.length, 0, `Shadow research errors: ${JSON.stringify(cycle.researchErrors)}`);
assert.ok(cycle.markets.every((item) => item.shadowResearch?.authority === 'OBSERVATION_ONLY'));
assert.ok(research.observationCount >= 15, 'One market should emit at least five families across three timeframes.');
assert.ok(research.noTradeCycleCount >= 1, 'NO_TRADE observations must be retained in research history.');

console.log(JSON.stringify({
  success: true,
  scanned: cycle.scanned,
  entered: cycle.entered,
  exited: cycle.exited,
  held: cycle.held,
  noTrade: cycle.noTrade,
  markets: cycle.markets.map((item) => ({
    market: item.market,
    action: item.action,
    evidenceGate: item.evidenceGate?.status ?? null,
    evidenceIds: item.evidenceIds,
    shadowAuthority: item.shadowResearch?.authority ?? null,
    shadowConsensus: item.shadowResearch?.consensus ?? null,
  })),
  research: {
    observations: research.observationCount,
    outcomes: research.outcomeCount,
    noTradeCycles: research.noTradeCycleCount,
    sampleSufficiency: research.sampleSufficiency,
    persistenceBacklog: research.persistenceBacklog,
  },
}, null, 2));
