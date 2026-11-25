import { expect, test } from 'bun:test';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { writeInstalledFile } from './write-installed-file.ts';

function setupTest() {
  const folder = createTempDir('write-installed-file').path;
  const path = join(folder, 'settings.json');

  return {
    folder,
    path,
    mode: (file: string) => statSync(file).mode % 0o1000,
    write: (
      plan: (before: string | null) => string | null,
      afterRead: (path: string) => void = () => {},
      newMode = 0o600,
    ) => writeInstalledFile({ path, newMode, plan }, { afterRead }),
  };
}

test('it creates a missing file, and its folder, with the new mode and no backup', () => {
  const ctx = setupTest();
  const nested = join(ctx.folder, 'a', 'b', 'file');
  const result = writeInstalledFile({ path: nested, newMode: 0o600, plan: () => 'one\n' }, {});

  expect({ result, text: readFileSync(nested, 'utf8'), mode: ctx.mode(nested) }).toStrictEqual({
    result: { kind: 'written', backup: null },
    text: 'one\n',
    mode: 0o600,
  });
});

test('it keeps the mode of an existing file and copies the old bytes to a backup of the same mode', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'old\n', { mode: 0o640 });

  const result = ctx.write(() => 'new\n');

  expect({
    result,
    text: readFileSync(ctx.path, 'utf8'),
    mode: ctx.mode(ctx.path),
    backup: readFileSync(`${ctx.path}.www-backup`, 'utf8'),
    backupMode: ctx.mode(`${ctx.path}.www-backup`),
  }).toStrictEqual({
    result: { kind: 'written', backup: `${ctx.path}.www-backup` },
    text: 'new\n',
    mode: 0o640,
    backup: 'old\n',
    backupMode: 0o640,
  });
});

test('it replaces an older backup', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'two\n');
  writeFileSync(`${ctx.path}.www-backup`, 'one\n');

  ctx.write(() => 'three\n');

  expect(readFileSync(`${ctx.path}.www-backup`, 'utf8')).toBe('two\n');
});

test('it changes nothing and makes no backup when the plan keeps the file', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'same\n');

  expect({
    result: ctx.write((before) => before),
    hasBackup: existsSync(`${ctx.path}.www-backup`),
  }).toStrictEqual({
    result: { kind: 'unchanged' },
    hasBackup: false,
  });
});

test('it writes to the target of a link and keeps the link', () => {
  const ctx = setupTest();
  const target = join(ctx.folder, 'dotfiles', 'settings.json');

  mkdirSync(join(ctx.folder, 'dotfiles'));
  writeFileSync(target, 'old\n');
  symlinkSync(target, ctx.path);

  ctx.write(() => 'new\n');

  expect({
    isLink: lstatSync(ctx.path).isSymbolicLink(),
    target: readFileSync(target, 'utf8'),
    backup: readFileSync(`${target}.www-backup`, 'utf8'),
  }).toStrictEqual({ isLink: true, target: 'new\n', backup: 'old\n' });
});

test('it plans again from the new bytes when the file changes between the read and the rename', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'a\n');

  const result = ctx.write(
    (before) => `${before ?? ''}ours\n`,
    () => {
      writeFileSync(ctx.path, 'a\ntheirs\n');
    },
  );

  expect({ result: result.kind, text: readFileSync(ctx.path, 'utf8') }).toStrictEqual({
    result: 'written',
    text: 'a\ntheirs\nours\n',
  });
});

test('it reports changed when the file differs again on the second try', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'a\n');

  let count = 0;

  const result = ctx.write(
    (before) => `${before ?? ''}ours\n`,
    () => {
      count += 1;

      writeFileSync(ctx.path, `${'x'.repeat(count)}\n`);
    },
  );

  expect({ result, text: readFileSync(ctx.path, 'utf8') }).toStrictEqual({
    result: { kind: 'changed' },
    text: 'xx\n',
  });
});
