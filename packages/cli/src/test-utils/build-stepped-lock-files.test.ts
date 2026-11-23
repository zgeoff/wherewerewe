import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createLockFiles } from '../store/create-lock-files.ts';
import { buildSteppedLockFiles } from './build-stepped-lock-files.ts';

test('it runs the step before each call from the given one on, and passes each call on', () => {
  const path = join(createTempDir('stepped-files').path, 'lock');
  const seen: boolean[] = [];
  const real = createLockFiles();

  const files = buildSteppedLockFiles(real, 1, () => {
    seen.push(real.read(path) !== null);
  });

  files.create(path, 'pid=1 ts=a\n');
  files.read(path);
  files.remove(path);

  expect({ seen, after: real.read(path) }).toStrictEqual({
    seen: [true, true],
    after: null,
  });
});

test('it passes a process read on without running the step', () => {
  const real = createLockFiles();
  const steps: string[] = [];

  const files = buildSteppedLockFiles(real, 0, () => {
    steps.push('step');
  });

  expect({ read: files.readProcess(process.pid), steps }).toStrictEqual({
    read: real.readProcess(process.pid),
    steps: [],
  });
});
