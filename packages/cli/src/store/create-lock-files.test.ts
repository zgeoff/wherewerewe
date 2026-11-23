import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createLockFiles } from './create-lock-files.ts';

function setupTest() {
  const folder = createTempDir('lock-files').path;

  return { folder, path: join(folder, 'lock'), files: createLockFiles() };
}

test('#create makes the file with its content and leaves no other file', () => {
  const ctx = setupTest();
  const created = ctx.files.create(ctx.path, 'pid=1 ts=a\n');

  expect({
    created,
    content: readFileSync(ctx.path, 'utf8'),
    left: readdirSync(ctx.folder),
  }).toStrictEqual({
    created: { ino: expect.any(Number), content: 'pid=1 ts=a\n', mtimeMs: expect.any(Number) },
    content: 'pid=1 ts=a\n',
    left: ['lock'],
  });
});

test('#create returns null and keeps the first file when the path exists', () => {
  const ctx = setupTest();

  ctx.files.create(ctx.path, 'pid=1 ts=a\n');

  const created = ctx.files.create(ctx.path, 'pid=2 ts=b\n');

  expect({
    created,
    content: readFileSync(ctx.path, 'utf8'),
    left: readdirSync(ctx.folder),
  }).toStrictEqual({ created: null, content: 'pid=1 ts=a\n', left: ['lock'] });
});

test('#read returns what create made, and null for no file', () => {
  const ctx = setupTest();
  const created = ctx.files.create(ctx.path, 'pid=1 ts=a\n');

  expect({
    read: ctx.files.read(ctx.path),
    missing: ctx.files.read(join(ctx.folder, 'none')),
  }).toStrictEqual({ read: created, missing: null });
});

test('#remove removes the file', () => {
  const ctx = setupTest();

  ctx.files.create(ctx.path, 'pid=1 ts=a\n');
  ctx.files.remove(ctx.path);

  expect(readdirSync(ctx.folder)).toStrictEqual([]);
});

test('#remove does nothing when the file is gone', () => {
  const ctx = setupTest();

  expect(() => {
    ctx.files.remove(ctx.path);
  }).not.toThrow();
});
