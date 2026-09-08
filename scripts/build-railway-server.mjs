import { readFile, writeFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';

const tempEntry = '.railway-server.generated.ts';
const source = await readFile('server.ts', 'utf8');

let patched = source.replace(
  'const PORT = 3000;',
  "const PORT = Number(process.env.INTERNAL_PORT || process.env.PORT || 3000);",
);

patched = patched
  .replace(
    "import { GoogleGenAI } from '@google/genai';",
    "import { LegacyOpenAIAdapter } from './server/openaiCompat';",
  )
  .replace(
    'const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });',
    "const genAI = new LegacyOpenAIAdapter({ apiKey: process.env.OPENAI_API_KEY || process.env.OPEN_AI_API });",
  )
  .replaceAll('process.env.GEMINI_API_KEY', '(process.env.OPENAI_API_KEY || process.env.OPEN_AI_API)')
  .replaceAll("model: 'gemini-2.5-flash'", "model: 'gpt-5.6-luna'")
  .replaceAll('Gemini API Quota exceeded', 'OpenAI API quota exceeded')
  .replaceAll('Gemini Search error:', 'OpenAI Search error:')
  .replaceAll('Gemini feed selection error', 'OpenAI feed selection error')
  .replaceAll('Gemini error generating tree', 'OpenAI error generating tree')
  .replaceAll('Generate pseudo-analytics using Gemini if available', 'Generate AI analytics using OpenAI if available')
  .replaceAll('Fallback object (if Gemini failed or missing key)', 'Fallback object (if OpenAI failed or missing key)')
  .replaceAll('geminiError', 'openaiError');

if (patched === source) {
  throw new Error('Could not patch the Railway production server.');
}
if (patched.includes("from '@google/genai'")) {
  throw new Error('Railway production build still contains a GoogleGenAI import.');
}
if (patched.includes('GEMINI_API_KEY')) {
  throw new Error('Railway production build still references GEMINI_API_KEY.');
}

await writeFile(tempEntry, patched, 'utf8');

try {
  await build({
    entryPoints: [tempEntry],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/server.cjs',
  });

  await build({
    entryPoints: ['railway-gateway.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    sourcemap: true,
    outfile: 'dist/gateway.cjs',
  });
} finally {
  await unlink(tempEntry).catch(() => undefined);
}
