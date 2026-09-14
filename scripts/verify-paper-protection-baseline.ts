import { readFile } from 'node:fs/promises';
import { verifyPaperProtectionBaselineAgainstExport } from '../src/trading/paperProtectionBaselineVerifier';

const usage = () => {
  console.error('Usage: npm run verify:paper-protection-baseline -- --export <canonical-export.json> --baseline <exact-baseline.json>');
};

const args = process.argv.slice(2);
const valueFor = (flag: string): string | null => {
  const index = args.indexOf(flag);
  return index >= 0 && index + 1 < args.length ? args[index + 1] ?? null : null;
};

const exportPath = valueFor('--export')?.trim() ?? '';
const baselinePath = valueFor('--baseline')?.trim() ?? '';

if (!exportPath || !baselinePath) {
  usage();
  process.exitCode = 2;
} else {
  const [exportArtifact, baselineArtifact] = await Promise.all([
    readFile(exportPath, 'utf8').then((raw) => JSON.parse(raw) as unknown),
    readFile(baselinePath, 'utf8').then((raw) => JSON.parse(raw) as unknown),
  ]);

  const result = await verifyPaperProtectionBaselineAgainstExport(exportArtifact, baselineArtifact);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
