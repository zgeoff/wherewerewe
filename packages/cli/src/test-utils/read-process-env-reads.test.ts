import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readProcessEnvReads } from './read-process-env-reads.ts';

test('it finds no read of the real environment in the package', () => {
  const packageDir = join(import.meta.dir, '..', '..');

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});

test('it reports a read of process.env, and not an entry, a PATH copy or a lock folder', () => {
  const packageDir = createTempDir('process-env-reads').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));
  writeFileSync(join(packageDir, 'src', 'cli.ts'), 'run(process.env);\n');

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    'const a = 1;\nconst host = process.env.X;\n',
  );

  writeFileSync(
    join(packageDir, 'src', 'paths.test.ts'),
    "const p = process.env['PATH'];\nconst q = [dir, process.env['PATH'] ?? ''].join(':');\n",
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2']);
});

test('it reports a read of the host on the line of a PATH copy', () => {
  const packageDir = createTempDir('process-env-same-line').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    "const env = { PATH: process.env['PATH'], host: process.env.CLAUDE_CODE_SESSION_ID };\n",
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:1']);
});

test('it reports no read in a comment that names process.env', () => {
  const packageDir = createTempDir('process-env-comment').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    '// reads process.env.HOME\n/* process.env.X\n   process.env.Y */\nconst a = 1; // process.env.Z\n',
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});

test('it reports no read in a comment that follows a regex that holds a quote', () => {
  const packageDir = createTempDir('process-env-regex-quote').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    "const possessive = /it's/u; // the agent's process.env.HOME\nconst slashes = /[//]+/gu; // process.env.X\n",
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});

test('it reports each read on its own source line past types, blank lines and comments', () => {
  const packageDir = createTempDir('process-env-lines').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    `import type { Host } from './types.ts';\n\n/* a block\n   comment */\ntype Pair = { a: Host };\nconst host = process.env.X; const label = \`\${\`//\`}\`;\nconst mode = process.env.NODE_ENV;\nconst run = process.env.BUN_ENV ?? process.env['NODE_ENV'];\n`,
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual([
    'src/render.ts:6',
    'src/render.ts:7',
    'src/render.ts:8',
  ]);
});
