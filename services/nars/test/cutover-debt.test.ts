import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260908234302_nars_v4_cutover_evidence_debt.sql",
  import.meta.url,
);

test("cutover debt surfaces preserve human retirement authority", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /'automatic_retirement',false/);
  assert.match(migration, /'retirement_requires_human_authorization',true/);
  assert.match(migration, /'execution_authority',false/);
  assert.match(migration, /with \(security_invoker=true\)/);
  assert.match(
    migration,
    /revoke all on table public\.nars_cutover_evidence_debt_v1 from public,anon,authenticated/,
  );
  assert.match(
    migration,
    /revoke all on table public\.nars_cutover_next_samples_v1 from public,anon,authenticated/,
  );
  assert.doesNotMatch(
    migration,
    /legacy_retirement_authorization['"]?\s*[,=:]\s*(true|'true')/i,
  );
});

test("event scoring drains stale work before fresh work", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(
    migration,
    /\(s\.event_id is null or s\.evaluated_at<c\.last_updated_at\) desc/,
  );
  assert.match(migration, /'scheduler_version','4\.5\.1-stale-first'/);
});
