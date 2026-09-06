import assert from 'node:assert/strict';
import test from 'node:test';
import type { StrategyGenome } from '../../src/trading/strategyGenome';
import { StrategyVault } from '../../src/trading/strategyVault';
import { validateCheckpoint } from './persistence';

const START = 1_780_000_000_000;
const legacyCheckpoint = () => ({
  schemaVersion: 1 as const,
  savedAt: START,
  reason: 'legacy',
  session: { schemaVersion: 1 },
  evidence: [],
  loop: { schemaVersion: 1 },
});

const genome = (): StrategyGenome => ({
  id: 'genome-runtime-persistence',
  generation: 0,
  createdAt: START,
  parentGenomeIds: [],
  strategyVersion: 'BO-CRYPTO-v0.1.6',
  modelVersion: null,
  markets: ['KRW-BTC'],
  regimes: ['RANGE'],
  timeframesMinutes: [15, 60, 240],
  weights: { eventNews: 0.2, trendMomentum: 0.5, meanReversion: 0.3 },
  thresholds: { entryScore: 70, exitScore: 45, minConfidence: 0.65 },
  risk: { maxPositionPct: 0.02, maxDailyLossPct: 0.01, maxTotalDrawdownPct: 0.05 },
  mutations: [],
  executionAuthority: false,
});

test('legacy schema-v1 checkpoint remains valid without Strategy Vault extension', () => {
  const parsed = validateCheckpoint(legacyCheckpoint());
  assert.equal(parsed.strategyVault, undefined);
});

test('Strategy Vault is accepted inside existing schema-v1 checkpoint JSON', () => {
  const vault = new StrategyVault();
  vault.registerGenome(genome(), START + 1);
  const parsed = validateCheckpoint({ ...legacyCheckpoint(), strategyVault: vault.checkpoint() });

  assert.equal(parsed.strategyVault?.schemaVersion, 1);
  assert.equal(parsed.strategyVault?.entries.length, 1);
  assert.equal(parsed.strategyVault?.entries[0]?.state, 'RESEARCH');
});

test('malformed Strategy Vault extension fails closed while legacy checkpoint rules stay unchanged', () => {
  assert.throws(() => validateCheckpoint({
    ...legacyCheckpoint(),
    strategyVault: {
      schemaVersion: 1,
      entries: [{ genomeId: '', fingerprint: '', registeredAt: 0, stateUpdatedAt: 0, parentGenomeIds: [] }],
      reviews: [],
    },
  }), /Strategy Vault checkpoint contains an invalid entry/);
});
