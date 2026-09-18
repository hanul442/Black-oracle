import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const path = new URL('../ops/b0-state-authority-matrix.json', import.meta.url);
const matrix = JSON.parse(await readFile(path, 'utf8'));

assert.equal(matrix.sprint, 'B0');
assert.equal(matrix.workPackage, 'B0.2');
assert.equal(matrix.status, 'PARTIAL');
assert.equal(matrix.productionMutation, false);
assert.equal(matrix.rules.tradingMode, 'PAPER_ONLY');
assert.equal(matrix.rules.betaLegacyAccess, 'READ_ONLY');
assert.equal(matrix.rules.reportExecutionAuthority, false);
assert.equal(matrix.rules.narsExecutionAuthority, false);
assert.equal(matrix.rules.unknownIsHealthy, false);

const records = new Map(matrix.records.map((record) => [record.id, record]));
for (const id of [
  'runtime-checkpoint', 'paper-positions', 'paper-orders-fills',
  'paper-runtime-ledger', 'canonical-event-ledger', 'strategy-identity',
  'qualification-cohort', 'strategy-research', 'scheduler-control', 'nars',
]) assert.ok(records.has(id), `missing authority record: ${id}`);

for (const record of matrix.records) {
  assert.ok(['READ_ONLY', 'NONE'].includes(record.betaAccess), `${record.id} grants beta mutation authority`);
  assert.ok(record.writerStatus !== 'VERIFIED' || record.evidence.length > 0, `${record.id} lacks evidence`);
}

assert.match(records.get('paper-positions').mutation, /deterministic-Risk-approved Paper/);
assert.match(records.get('paper-orders-fills').mutation, /PAPER only/);
assert.match(records.get('canonical-event-ledger').mutation, /UPDATE\/DELETE denied/);
assert.match(records.get('qualification-cohort').mutation, /Never reset, rearm, rekey, reseed/);
assert.match(records.get('strategy-research').mutation, /execution_authority=false/);
assert.match(records.get('scheduler-control').mutation, /cannot prove checkpoint persistence/);
assert.match(records.get('nars').mutation, /cannot create orders/);
assert.notEqual(records.get('paper-runtime-ledger').store, records.get('canonical-event-ledger').store);
assert.ok(matrix.openBlockers.length >= 4);

console.log(`B0.2 state authority matrix: ${matrix.records.length} records verified; status=${matrix.status}`);
