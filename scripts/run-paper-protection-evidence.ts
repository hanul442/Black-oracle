import { readFile, writeFile } from 'node:fs/promises';
import {
  buildExactPaperProtectionEvidenceBaseline,
  parsePaperProtectionEvidenceBaseline,
  runPaperProtectionEvidencePass,
} from '../src/trading/paperProtectionEvidencePass';

const usage = () => {
  console.error('Usage: npm run evidence:paper-protection -- --runtime <runtime-id> [--baseline <baseline.json>] [--baseline-output <exact-baseline.json>] [--page-size <n>] [--max-rows <n>]');
};

const args = process.argv.slice(2);
const valueFor = (flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] ?? null : null;
};

const runtimeId = valueFor('--runtime')?.trim() ?? '';
const baselinePath = valueFor('--baseline')?.trim() ?? '';
const baselineOutputPath = valueFor('--baseline-output')?.trim() ?? '';
const pageSize = valueFor('--page-size');
const maxRows = valueFor('--max-rows');
const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!runtimeId) {
  usage();
  process.exitCode = 2;
} else if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only canonical evidence.');
} else {
  const baseline = baselinePath
    ? parsePaperProtectionEvidenceBaseline(JSON.parse(await readFile(baselinePath, 'utf8')))
    : null;

  const result = await runPaperProtectionEvidencePass({
    runtimeId,
    supabaseUrl,
    supabaseKey,
    baseline,
    pageSize: pageSize == null ? undefined : Number(pageSize),
    maxRows: maxRows == null ? undefined : Number(maxRows),
  });

  if (baselineOutputPath) {
    const exactBaseline = buildExactPaperProtectionEvidenceBaseline(result);
    await writeFile(baselineOutputPath, `${JSON.stringify(exactBaseline, null, 2)}\n`, 'utf8');
    console.error(`Wrote exact Paper protection baseline for ${result.runtimeId} (${result.export.snapshotFingerprint}) to ${baselineOutputPath}.`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
