import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = JSON.parse(await readFile(new URL('../ops/b0-state-authority-matrix.json', import.meta.url), 'utf8'));

const valid = (matrix) => {
  const records = new Map(matrix.records.map((record) => [record.id, record]));
  return matrix.status === 'PARTIAL'
    && matrix.productionMutation === false
    && matrix.rules.tradingMode === 'PAPER_ONLY'
    && matrix.rules.reportExecutionAuthority === false
    && matrix.rules.narsExecutionAuthority === false
    && matrix.records.every((record) => ['READ_ONLY', 'NONE'].includes(record.betaAccess))
    && records.get('paper-runtime-ledger')?.store !== records.get('canonical-event-ledger')?.store
    && /cannot prove checkpoint persistence/.test(records.get('scheduler-control')?.mutation ?? '')
    && /Never reset, rearm, rekey, reseed/.test(records.get('qualification-cohort')?.mutation ?? '');
};

test('accepts the fail-closed B0.2 matrix', () => assert.equal(valid(source), true));

for (const [name, mutate] of [
  ['beta legacy write authority', (m) => { m.records[0].betaAccess = 'READ_WRITE'; }],
  ['LIVE mode', (m) => { m.rules.tradingMode = 'LIVE'; }],
  ['Report execution authority', (m) => { m.rules.reportExecutionAuthority = true; }],
  ['NARS execution authority', (m) => { m.rules.narsExecutionAuthority = true; }],
  ['collapsed Ledgers', (m) => { m.records.find((r) => r.id === 'canonical-event-ledger').store = m.records.find((r) => r.id === 'paper-runtime-ledger').store; }],
  ['scheduler success as persistence', (m) => { m.records.find((r) => r.id === 'scheduler-control').mutation = 'HTTP 200 proves persistence'; }],
  ['qualification rekey', (m) => { m.records.find((r) => r.id === 'qualification-cohort').mutation = 'rekey allowed'; }],
  ['false completion', (m) => { m.status = 'COMPLETE'; }],
]) {
  test(`rejects ${name}`, () => {
    const candidate = structuredClone(source);
    mutate(candidate);
    assert.equal(valid(candidate), false);
  });
}
