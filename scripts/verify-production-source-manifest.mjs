import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'ops', 'production-source-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const fail = (message) => {
  console.error(`[source-truth] FAIL: ${message}`);
  process.exitCode = 1;
};

const migrationDirs = [
  path.join(root, 'supabase', 'migrations'),
  path.join(root, 'services', 'nars', 'supabase', 'migrations'),
];
const migrationFiles = migrationDirs.flatMap((dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).map((name) => ({ name, path: path.join(dir, name) }))
    : [],
);

const groups = manifest.migrationVersions || {};
const expectedVersions = Object.values(groups).flat();
if (expectedVersions.length !== 55) fail(`expected manifest to contain 55 Production migrations, found ${expectedVersions.length}`);
if (new Set(expectedVersions).size !== expectedVersions.length) fail('duplicate Production migration version in manifest');

for (const version of expectedVersions) {
  const matches = migrationFiles.filter((file) => file.name.startsWith(`${version}_`));
  if (matches.length !== 1) fail(`migration ${version} must have exactly one Git source file; found ${matches.length}`);
}

for (const provisional of ['202609010001_', '202609010002_', '202609010003_']) {
  if (migrationFiles.some((file) => file.name.startsWith(provisional))) {
    fail(`superseded provisional migration filename remains: ${provisional}`);
  }
}

const functions = manifest.edgeFunctions || [];
if (functions.length !== 13) fail(`expected manifest to contain 13 deployed Edge Functions, found ${functions.length}`);
if (new Set(functions.map((fn) => fn.slug)).size !== functions.length) fail('duplicate Edge Function slug in manifest');

for (const fn of functions) {
  const base = fn.role === 'NARS'
    ? path.join(root, 'services', 'nars', 'supabase', 'functions', fn.slug)
    : path.join(root, 'supabase', 'functions', fn.slug);
  const entrypoint = path.join(base, 'index.ts');
  if (!fs.existsSync(entrypoint)) fail(`missing Edge Function source: ${fn.slug} -> ${path.relative(root, entrypoint)}`);
  if (fn.verifyJwt === false && !['nars-shadow-poll', 'nars-evidence-acquire', 'black-oracle-runtime-status'].includes(fn.slug)) {
    fail(`unexpected verifyJwt=false function in manifest: ${fn.slug}`);
  }
}

if (!manifest.policy?.productionMustBeRepresentedInGit) fail('productionMustBeRepresentedInGit policy must remain true');
if (manifest.policy?.legacyRetirementAutomatic !== false) fail('legacy retirement must remain explicitly non-automatic');
if (manifest.policy?.liveTrading !== false) fail('S0 manifest must remain PAPER-only');

if (!process.exitCode) {
  console.log(`[source-truth] PASS: ${expectedVersions.length} migrations and ${functions.length} Edge Functions are represented in Git.`);
  console.log(`[source-truth] canonical runtime: ${manifest.canonicalRuntime.provider}/${manifest.canonicalRuntime.service}/${manifest.canonicalRuntime.paperRuntimeId}`);
}
