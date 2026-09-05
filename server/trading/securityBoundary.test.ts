import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootFile = (name: string) => new URL(`../../${name}`, import.meta.url);

test('Firestore user intelligence collections require authenticated ownership and deny fallback', async () => {
  const rules = await readFile(rootFile('firestore.rules'), 'utf-8');
  assert.match(rules, /request\.auth\s*!=\s*null/);
  assert.match(rules, /request\.auth\.uid\s*==\s*userId/);
  assert.match(rules, /match\s+\/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;/s);
  assert.doesNotMatch(rules, /function\s+isSignedIn\s*\([^)]*\)\s*\{\s*return\s+true\s*;/s);
});

test('server Firebase user resolver verifies bearer tokens rather than trusting caller identity fields', async () => {
  const source = await readFile(rootFile('server/auth/firebaseUser.ts'), 'utf-8');
  assert.match(source, /authorization/i);
  assert.match(source, /Bearer/i);
  assert.match(source, /accounts:lookup/);
  assert.match(source, /localId/);
  assert.doesNotMatch(source, /return\s+\{\s*uid:\s*request\.(body|query)/s);
});

test('Council scenario endpoint keeps explicit server or verified-user authorization', async () => {
  const source = await readFile(rootFile('api/council-scenarios.ts'), 'utf-8');
  assert.match(source, /verifyFirebaseUser/);
  assert.match(source, /CRON_SECRET/);
  assert.match(source, /executionAuthority:\s*false/);
  assert.doesNotMatch(source, /request\.(body|query)\??\.userId/);
});
