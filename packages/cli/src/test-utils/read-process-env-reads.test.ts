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
