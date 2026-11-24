import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readRealPathReads } from './read-real-path-reads.ts';

test('it finds no test that reads the real PATH or builds one from a host folder', () => {
  expect(readRealPathReads(join(import.meta.dir, '..', '..'))).toStrictEqual([]);
});

test('it reports a read of the real PATH and an absolute folder in a PATH, in a test file only', () => {
  const packageDir = createTempDir('real-path-reads').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'a.test.ts'),
    "const a = 1;\nconst p = [stub, process.env['PATH']].join(':');\nconst q = process?.env?.PATH;\n",
  );

  writeFileSync(
    join(packageDir, 'src', 'b.test.ts'),
    "const env = { PATH: [bin, '/usr/bin'].join(':'), HOME: root };\nconst ok = { PATH: bin };\n",
  );

  writeFileSync(join(packageDir, 'src', 'c.ts'), 'const p = process.env.PATH;\n');

  writeFileSync(
    join(packageDir, 'e2e', 'build-packed-install.test.ts'),
    'const p = process.env.PATH;\n',
  );

  expect(readRealPathReads(packageDir).toSorted()).toStrictEqual([
    'src/a.test.ts:2',
    'src/a.test.ts:3',
    'src/b.test.ts:1',
  ]);
});

test('it reports a host folder that reaches a PATH through a variable, a helper or an assignment', () => {
  const packageDir = createTempDir('real-path-reads-flow').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  writeFileSync(
    join(packageDir, 'src', 'a.test.ts'),
    [
      "const hostBin = '/usr/bin';",
      'const env = { PATH: hostBin };',
      "function buildPath() { return ['/opt/tools', bin].join(':'); }",
      'const second = { PATH: buildPath() };',
      "const viaArrow = () => join('/srv', 'bin');",
      'const third = { PATH: viaArrow() };',
      "const chained = [hostBin, 'x'].join(':');",
      'const fourth = { PATH: chained };',
      'env.PATH = hostBin;',
      "env['PATH'] = bin;",
      'const fine = { PATH: bin };',
      "const cwd = '/work';",
      'const unrelated = { PATH: bin, cwd };',
      '',
    ].join('\n'),
  );

  writeFileSync(
    join(packageDir, 'src', 'b.test.ts'),
    'const { PATH } = process.env;\nconst copy = { ...process.env, HOME: root };\nconst home = process.env.HOME;\n',
  );

  expect(readRealPathReads(packageDir).toSorted()).toStrictEqual([
    'src/a.test.ts:2',
    'src/a.test.ts:4',
    'src/a.test.ts:6',
    'src/a.test.ts:8',
    'src/a.test.ts:9',
    'src/b.test.ts:1',
    'src/b.test.ts:2',
  ]);
});
