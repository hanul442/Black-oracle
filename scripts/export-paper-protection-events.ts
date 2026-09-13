import { writeFile } from 'node:fs/promises';
import { exportCanonicalPaperEvents } from '../src/trading/canonicalPaperEventExport';

const usage = () => {
  console.error('Usage: npm run export:paper-protection-events -- --runtime <runtime-id> [--output <events.json|->] [--page-size <n>] [--max-rows <n>]');
};

const args = process.argv.slice(2);
const valueFor = (flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] ?? null : null;
};

const runtimeId = valueFor('--runtime')?.trim() ?? '';
const outputPath = valueFor('--output')?.trim() || '-';
const pageSize = valueFor('--page-size');
const maxRows = valueFor('--max-rows');
const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!runtimeId) {
  usage();
  process.exitCode = 2;
} else if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for read-only canonical export.');
} else {
  const result = await exportCanonicalPaperEvents({
    runtimeId,
    supabaseUrl,
    supabaseKey,
    pageSize: pageSize == null ? undefined : Number(pageSize),
    maxRows: maxRows == null ? undefined : Number(maxRows),
  });

  const payload = JSON.stringify({
    runtimeId: result.runtimeId,
    count: result.rows.length,
    pages: result.pages,
    pageSize: result.pageSize,
    truncated: result.truncated,
    snapshotRecordedAt: result.snapshotRecordedAt,
    rows: result.rows,
  }, null, 2);

  if (outputPath === '-') {
    process.stdout.write(`${payload}\n`);
  } else {
    await writeFile(outputPath, `${payload}\n`, 'utf8');
    console.error(`Exported ${result.rows.length} canonical rows for ${runtimeId} at snapshot ${result.snapshotRecordedAt ?? 'empty'} to ${outputPath}${result.truncated ? ' (TRUNCATED)' : ''}.`);
  }
}
