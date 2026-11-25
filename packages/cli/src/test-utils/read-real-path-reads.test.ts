import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readRealPathReads } from './read-real-path-reads.ts';

function setupTest() {
  const packageDir = createTempDir('real-path-reads').path;

  mkdirSync(join(packageDir, 'src'));
  mkdirSync(join(packageDir, 'e2e'));

  return {
    packageDir,
    realPackageDir: join(import.meta.dir, '..', '..'),
    readRealPathReads,
  };
}

test('it finds no test that reads the real PATH or builds one from a host folder', () => {
  const ctx = setupTest();

  expect(ctx.readRealPathReads(ctx.realPackageDir)).toStrictEqual([]);
});

test('it reports a read of the real PATH and an absolute folder in a PATH, in a test file only', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.packageDir, 'src', 'a.test.ts'),
    "const a = 1;\nconst p = [stub, process.env['PATH']].join(':');\nconst q = process?.env?.PATH;\n",
  );

  writeFileSync(
    join(ctx.packageDir, 'src', 'b.test.ts'),
    "const env = { PATH: [bin, '/usr/bin'].join(':'), HOME: root };\nconst ok = { PATH: bin };\n",
  );

  writeFileSync(join(ctx.packageDir, 'src', 'c.ts'), 'const p = process.env.PATH;\n');

  writeFileSync(
    join(ctx.packageDir, 'e2e', 'compiled-binary.test.ts'),
    'const p = process.env.PATH;\n',
  );

  expect(ctx.readRealPathReads(ctx.packageDir).toSorted()).toStrictEqual([
    'src/a.test.ts:2',
    'src/a.test.ts:3',
    'src/b.test.ts:1',
  ]);
});

test('it reports a host folder that reaches a PATH through a variable, a helper or an assignment', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.packageDir, 'src', 'a.test.ts'),
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
    join(ctx.packageDir, 'src', 'b.test.ts'),
    'const { PATH } = process.env;\nconst copy = { ...process.env, HOME: root };\nconst home = process.env.HOME;\n',
  );

  expect(ctx.readRealPathReads(ctx.packageDir).toSorted()).toStrictEqual([
    'src/a.test.ts:2',
    'src/a.test.ts:4',
    'src/a.test.ts:6',
    'src/a.test.ts:8',
    'src/a.test.ts:9',
    'src/b.test.ts:1',
    'src/b.test.ts:2',
  ]);
});

test('it reports a host folder that reaches a PATH through a typed declaration or a later assignment', () => {
  const ctx = setupTest();

  writeFileSync(
    join(ctx.packageDir, 'src', 'a.test.ts'),
    [
      "const typedBin: string = '/usr/bin';",
      'const first = { PATH: typedBin };',
      'let lateBin;',
      "lateBin = '/opt/bin';",
      'const second = { PATH: lateBin };',
      "const typedHelper: () => string = () => join('/srv', 'bin');",
      'const third = { PATH: typedHelper() };',
      "const typedList: Record<string, string> = { home: '/home' };",
      'const fourth = { PATH: typedList.home };',
      "const typedSafe: string = 'bin';",
      'const fine = { PATH: typedSafe };',
      'let lateSafe;',
      "lateSafe = 'bin';",
      'const alsoFine = { PATH: lateSafe };',
      '',
    ].join('\n'),
  );

  expect(ctx.readRealPathReads(ctx.packageDir)).toStrictEqual([
    'src/a.test.ts:2',
    'src/a.test.ts:5',
    'src/a.test.ts:7',
    'src/a.test.ts:9',
  ]);
});
