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

test('it reports a read of process.env written as a bracket access', () => {
  const packageDir = createTempDir('process-env-bracket').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    "const a = 1;\nconst host = process['env'].X;\nconst mode = process [ \"env\" ] ['MODE'];\n",
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2', 'src/render.ts:3']);
});

test('it reports a read of process.env split over lines, on the line of process', () => {
  const packageDir = createTempDir('process-env-split').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    'const a = 1;\nconst host = process[\n"env"\n].X;\n',
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2']);
});

test('it reports no read in a string that holds the access', () => {
  const packageDir = createTempDir('process-env-string').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    'const a = 1;\nconst s = "process[\'env\']";\n',
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});

test('it reports a read that a keyword follows, and parses it', () => {
  const packageDir = createTempDir('process-env-keyword').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    'const a = 1;\nconst b = process["env"]instanceof Object;\n',
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2']);
});

test('it reports a read inside a template substitution, on its own line', () => {
  const packageDir = createTempDir('process-env-template').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'render.ts'),
    `const a = 1;\nconst b = \`line\n\${process.env.HOME}\`;\n`,
  );

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:3']);
});

test.each([
  { title: 'a division after a postfix step', line: 'let n = 0; n++ / process.env.X;' },
  { title: 'a division after a grouped value', line: 'const r = (a + b) / process.env.X;' },
  {
    title: 'a computed key that starts with PATH',
    line: 'const p = process.env["PATH" + suffix];',
  },
])('it reports a read on a line with $title', (row) => {
  const packageDir = createTempDir('process-env-slash').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));
  writeFileSync(join(packageDir, 'src', 'render.ts'), `const a = 1;\n${row.line}\n`);

  expect(readProcessEnvReads(packageDir)).toStrictEqual(['src/render.ts:2']);
});

test.each([
  { title: 'a regex after the head of an if', line: 'if (ok) /process.env/.test(s);' },
  { title: 'a regex after the head of a while', line: 'while (ok) /process.env/.test(s);' },
  { title: 'a regex that starts a statement after a block', line: '{}\n/process.env/.test(s);' },
  { title: 'a PATH copy', line: 'const p = process.env["PATH"];' },
])('it reports no read on a line with $title', (row) => {
  const packageDir = createTempDir('process-env-slash-none').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));
  writeFileSync(join(packageDir, 'src', 'render.ts'), `const a = 1;\n${row.line}\n`);

  expect(readProcessEnvReads(packageDir)).toStrictEqual([]);
});
