import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../ops/supabase/${name}`, import.meta.url), 'utf8');

export const validateBetaAuthoritySql = ({ candidate, rollback, negative }) => {
  assert.match(candidate, /CANDIDATE ONLY/);
  assert.match(candidate, /create role black_oracle_beta_server\s+login noinherit nobypassrls nosuperuser nocreatedb nocreaterole noreplication/i);
  assert.match(candidate, /revoke all privileges on all tables in schema public from black_oracle_beta_server/i);
  assert.match(candidate, /revoke all privileges on all functions in schema public from black_oracle_beta_server/i);
  assert.match(candidate, /create schema if not exists black_oracle_beta authorization black_oracle_beta_owner/i);
  assert.match(candidate, /revoke all on schema black_oracle_beta from public, anon, authenticated, service_role/i);
  assert.match(candidate, /grant usage on schema black_oracle_beta to black_oracle_beta_server/i);
  assert.doesNotMatch(candidate, /password\s+['"]/i);
  assert.doesNotMatch(candidate, /grant\s+(?:all|insert|update|delete|truncate).*schema public.*black_oracle_beta_server/is);

  assert.match(rollback, /drop schema if exists black_oracle_beta restrict/i);
  assert.doesNotMatch(rollback, /drop\s+(?:table|schema).*public/i);
  assert.doesNotMatch(rollback, /delete\s+from|truncate\s+public|update\s+public/i);

  for (const operation of ['insert into public.black_oracle_events', 'update public.black_oracle_trading_runtime', 'delete from public.black_oracle_trading_runtime', 'truncate public.black_oracle_trading_runtime', 'create table public.b0_forbidden_probe', 'alter table public.black_oracle_trading_runtime owner']) {
    assert.ok(negative.toLowerCase().includes(operation), `missing negative probe: ${operation}`);
  }
  assert.match(negative, /insert into black_oracle_beta\.authority_probe/i);
  assert.match(negative, /has_schema_privilege\('anon', 'black_oracle_beta', 'USAGE'\)/i);
  assert.match(negative, /rollback;/i);

  return { contractValid: true, executed: false, productionAuthorized: false };
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log(JSON.stringify(validateBetaAuthoritySql({
    candidate: read('b0_beta_authority_candidate.sql'),
    rollback: read('b0_beta_authority_rollback.sql'),
    negative: read('b0_beta_authority_negative_test.sql')
  }), null, 2));
}
