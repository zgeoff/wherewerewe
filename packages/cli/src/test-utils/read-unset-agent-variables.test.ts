import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readUnsetAgentVariables } from './read-unset-agent-variables.ts';

test('it finds no e2e test that runs www without naming each agent variable', () => {
  const packageDir = join(import.meta.dir, '..', '..');

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
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

test('it reports each agent variable that an e2e test only names in a comment', () => {
  const packageDir = createTempDir('unset-agent-variables-comment').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\n// sets CLAUDE_CODE_SESSION_ID, CODEX_SESSION_ID and CODEX_THREAD_ID\n/* CODEX_THREAD_ID */\n",
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});
