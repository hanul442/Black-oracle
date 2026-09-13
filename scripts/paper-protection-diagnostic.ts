import { readFile } from 'node:fs/promises';
import { stdin } from 'node:process';
import { buildPaperProtectionDiagnostic } from '../src/trading/paperProtectionDiagnostic';
import type { CanonicalPaperEventRow } from '../src/trading/canonicalPaperProtectionReplay';

const usage = () => {
  console.error('Usage: npm run diagnostic:paper-protection -- --runtime <runtime-id> --input <events.json|->');
};

const args = process.argv.slice(2);
const valueFor = (flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] ?? null : null;
};

const runtimeId = valueFor('--runtime')?.trim() ?? '';
const inputPath = valueFor('--input')?.trim() ?? '';
if (!runtimeId || !inputPath) {
  usage();
  process.exitCode = 2;
} else {
  const raw = inputPath === '-'
    ? await new Promise<string>((resolve, reject) => {
        let data = '';
        stdin.setEncoding('utf8');
        stdin.on('data', (chunk) => { data += chunk; });
        stdin.on('end', () => resolve(data));
        stdin.on('error', reject);
      })
    : await readFile(inputPath, 'utf8');

  const parsed: unknown = JSON.parse(raw);
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : null;

  if (!rows) {
    throw new Error('Input must be a JSON array of canonical event rows or an object with a rows array.');
  }

  const diagnostic = buildPaperProtectionDiagnostic(runtimeId, rows as CanonicalPaperEventRow[]);
  process.stdout.write(`${JSON.stringify(diagnostic, null, 2)}\n`);
}
