import { expect, test } from 'bun:test';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildTextPlan } from '../test-utils/build-text-plan.ts';
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
      beforeRename: (path: string) => void = () => {},
      newMode = 0o600,
    ) =>
      writeInstalledFile(
        { path, newMode, plan: (before) => buildTextPlan(plan(before) ?? before ?? '') },
        { beforeRename },
      ),
  };
}

test('it creates a missing file, and its folder, with the new mode and no backup', () => {
  const ctx = setupTest();
  const nested = join(ctx.folder, 'a', 'b', 'file');

  const result = writeInstalledFile(
    { path: nested, newMode: 0o600, plan: () => buildTextPlan('one\n') },
    {},
  );

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

test('it reads the file for the last time after the backup and the replacement are on disk', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'old\n');

  const seen: { backup: boolean; hasTemporary: boolean }[] = [];

  ctx.write(
    () => 'new\n',
    () => {
      const names = readdirSync(ctx.folder);

      seen.push({
        backup: names.includes('settings.json.www-backup'),
        hasTemporary: names.some((name) => name.startsWith('settings.json.tmp-')),
      });
    },
  );

  expect(seen).toStrictEqual([{ backup: true, hasTemporary: true }]);
});

test('it keeps a save made in the last gap before the rename, by starting over', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'a\n');

  let count = 0;

  const result = ctx.write(
    (before) => `${before ?? ''}ours\n`,
    () => {
      count += 1;

      if (count === 1) {
        writeFileSync(ctx.path, 'a\nsaved while the temporary file was synced\n');
      }
    },
  );

  expect({ result: result.kind, text: readFileSync(ctx.path, 'utf8') }).toStrictEqual({
    result: 'written',
    text: 'a\nsaved while the temporary file was synced\nours\n',
  });
});

test('it leaves no temporary file behind when the file changes twice', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'a\n');

  let count = 0;

  ctx.write(
    (before) => `${before ?? ''}ours\n`,
    () => {
      count += 1;

      writeFileSync(ctx.path, `${'x'.repeat(count)}\n`);
    },
  );

  expect(readdirSync(ctx.folder).toSorted()).toStrictEqual([
    'settings.json',
    'settings.json.www-backup',
  ]);
});

test('it replaces a link at the backup path and never writes through it', () => {
  const ctx = setupTest();
  const victim = join(ctx.folder, 'victim.txt');

  writeFileSync(ctx.path, 'old\n');
  writeFileSync(victim, 'not yours\n');
  symlinkSync(victim, `${ctx.path}.www-backup`);

  ctx.write(() => 'new\n');

  expect({
    victim: readFileSync(victim, 'utf8'),
    isLink: lstatSync(`${ctx.path}.www-backup`).isSymbolicLink(),
    backup: readFileSync(`${ctx.path}.www-backup`, 'utf8'),
  }).toStrictEqual({ victim: 'not yours\n', isLink: false, backup: 'old\n' });
});

test('it reports a refusal and writes nothing', () => {
  const ctx = setupTest();

  writeFileSync(ctx.path, 'old\n');

  const result = writeInstalledFile(
    { path: ctx.path, newMode: 0o600, plan: () => ({ kind: 'refused', reason: 'unreadable' }) },
    {},
  );

  expect({ result, text: readFileSync(ctx.path, 'utf8') }).toStrictEqual({
    result: { kind: 'refused' },
    text: 'old\n',
  });
});
