import { readFile, writeFile, unlink } from 'node:fs/promises';
import { build } from 'esbuild';

const tempEntry = '.railway-server.generated.ts';
const source = await readFile('server.ts', 'utf8');
const patched = source.replace(
  'const PORT = 3000;',
  "const PORT = Number(process.env.INTERNAL_PORT || process.env.PORT || 3000);",
);

if (patched === source) {
  throw new Error('Could not patch the internal server port.');
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
