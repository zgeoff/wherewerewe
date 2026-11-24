import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createLockFiles } from '../store/create-lock-files.ts';
import { buildCountingLockFiles } from './build-counting-lock-files.ts';

test('it counts the create calls and runs the callback just before the second', () => {
  const path = join(createTempDir('counting-files').path, 'lock');
  const real = createLockFiles();
  const seen: boolean[] = [];

  const counting = buildCountingLockFiles(real, () => {
    seen.push(real.read(path) !== null);
    real.remove(path);
  });

  counting.files.create(path, 'pid=1 ts=a\n');

  const second = counting.files.create(path, 'pid=2 ts=b\n');

  expect({ count: counting.getCreateCount(), seen, took: second !== null }).toStrictEqual({
    count: 2,
    seen: [true],
    took: true,
  });
});

test('it passes the other calls on, and runs no callback before a second create', () => {
  const path = join(createTempDir('counting-files').path, 'lock');
  const real = createLockFiles();
  const calls: string[] = [];
  const counting = buildCountingLockFiles(real, () => calls.push('second'));

  counting.files.create(path, 'pid=1 ts=a\n');

  const content = counting.files.read(path)?.content;

  expect({ content, count: counting.getCreateCount(), calls }).toStrictEqual({
    content: 'pid=1 ts=a\n',
    count: 1,
    calls: [],
  });
});
