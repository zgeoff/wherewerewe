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

test('it reports each agent variable named only in a comment after a regex that holds a quote', () => {
  const packageDir = createTempDir('unset-agent-variables-regex-quote').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\nconst possessive = /it's/u; // the agent's CLAUDE_CODE_SESSION_ID, CODEX_SESSION_ID and CODEX_THREAD_ID\n",
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});

test('it reports each agent variable named only in a block comment that holds a quote', () => {
  const packageDir = createTempDir('unset-agent-variables-block-quote').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\n/* the agent's CLAUDE_CODE_SESSION_ID,\n   CODEX_SESSION_ID and CODEX_THREAD_ID */\nconst label = 'a';\n",
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});

test('it finds each agent variable set after a template literal that nests a comment marker', () => {
  const packageDir = createTempDir('unset-agent-variables-template').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    `resolveProgram('www');\nconst label = \`\${\`//\`}\`; const env = { CLAUDE_CODE_SESSION_ID: '', CODEX_SESSION_ID: '', CODEX_THREAD_ID: '' };\n`,
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
});

test('it finds each agent variable set after a regex with a slash in a character class', () => {
  const packageDir = createTempDir('unset-agent-variables-regex-class').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\nconst slashes = /[//]+/gu; const env = { CLAUDE_CODE_SESSION_ID: '', CODEX_SESSION_ID: '', CODEX_THREAD_ID: '' };\n",
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
});

test('it reports each agent variable of an e2e test that runs www with double quotes', () => {
  const packageDir = createTempDir('unset-agent-variables-double-quotes').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    'resolveProgram("www");\nconst env = { CODEX_SESSION_ID: "", CODEX_THREAD_ID: "" };\n',
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
  ]);
});

test('it reports each agent variable that an e2e test names in a string and never sets as a key', () => {
  const packageDir = createTempDir('unset-agent-variables-string').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    "resolveProgram('www');\nconst label = 'CLAUDE_CODE_SESSION_ID CODEX_SESSION_ID CODEX_THREAD_ID';\n",
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});

test('it reports each agent variable that one string holds with its colons and sets nothing', () => {
  const packageDir = createTempDir('unset-agent-variables-key-string').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    'resolveProgram("www");\nconst s = "{CLAUDE_CODE_SESSION_ID: CODEX_SESSION_ID: CODEX_THREAD_ID:";\n',
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});

test('it finds each agent variable set as a shorthand key', () => {
  const packageDir = createTempDir('unset-agent-variables-shorthand').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    'resolveProgram("www");\nconst CLAUDE_CODE_SESSION_ID = "", CODEX_SESSION_ID = "", CODEX_THREAD_ID = "";\nconst env = { CLAUDE_CODE_SESSION_ID, CODEX_SESSION_ID, CODEX_THREAD_ID };\n',
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
});

test('it finds each agent variable set as a computed key', () => {
  const packageDir = createTempDir('unset-agent-variables-computed').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    'resolveProgram("www");\nconst env = { ["CLAUDE_CODE_SESSION_ID"]: "", ["CODEX_SESSION_ID"]: "", ["CODEX_THREAD_ID"]: "" };\n',
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([]);
});

test('it reports each agent variable that a destructuring pattern names and sets nothing', () => {
  const packageDir = createTempDir('unset-agent-variables-pattern').path;

  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'e2e', 'run.test.ts'),
    'resolveProgram("www");\nconst { CLAUDE_CODE_SESSION_ID, CODEX_SESSION_ID, CODEX_THREAD_ID } = process.env;\n',
  );

  expect(readUnsetAgentVariables(packageDir)).toStrictEqual([
    'e2e/run.test.ts: CLAUDE_CODE_SESSION_ID',
    'e2e/run.test.ts: CODEX_SESSION_ID',
    'e2e/run.test.ts: CODEX_THREAD_ID',
  ]);
});
