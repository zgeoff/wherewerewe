import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readProcessEnvReads, readUnsetAgentVariables } from './read-process-env-reads.ts';

test('it finds no read of the real environment in the package', () => {
  const packageDir = join(import.meta.dir, '..', '..');

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});

test('it finds no e2e test that runs www without naming each agent variable', () => {
  const packageDir = join(import.meta.dir, '..', '..');

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
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

  writeFileSync(join(packageDir, 'src', 'paths.test.ts'), "const p = process.env['PATH'];\n");

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2']);
});

test('it reports each agent variable that an e2e test running www leaves out', () => {
  const packageDir = createTempDir('unset-agent-variables').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\nconst env = { CLAUDE_CODE_SESSION_ID: '' };\n",
  );

  writeFileSync(join(packageDir, 'e2e', 'help.test.ts'), "resolveProgram('other');\n");

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});
