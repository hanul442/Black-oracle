import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBetaAuthoritySql } from './verify-b0-beta-authority-sql.mjs';

const read = (name) => fs.readFileSync(new URL(`../ops/supabase/${name}`, import.meta.url), 'utf8');
const fixture = () => ({
  candidate: read('b0_beta_authority_candidate.sql'),
  rollback: read('b0_beta_authority_rollback.sql'),
  negative: read('b0_beta_authority_negative_test.sql')
});

test('B0.3 candidate package validates without claiming execution', () => {
  assert.deepEqual(validateBetaAuthoritySql(fixture()), {
    contractValid: true,
    executed: false,
    productionAuthorized: false
  });
});

for (const [name, change] of [
  ['embedded password', f => { f.candidate += "\nalter role black_oracle_beta_server password 'secret';"; }],
  ['legacy insert grant', f => { f.candidate += '\ngrant insert on all tables in schema public to black_oracle_beta_server;'; }],
  ['unsafe rollback cascade', f => { f.rollback = f.rollback.replace('restrict', 'cascade'); }],
  ['missing legacy update probe', f => { f.negative = f.negative.replace('update public.black_oracle_trading_runtime', 'select public.black_oracle_trading_runtime'); }],
  ['missing beta write proof', f => { f.negative = f.negative.replace('insert into black_oracle_beta.authority_probe', 'select * from black_oracle_beta.authority_probe'); }]
]) {
  test(`rejects ${name}`, () => {
    const files = fixture();
    change(files);
    assert.throws(() => validateBetaAuthoritySql(files));
  });
}
