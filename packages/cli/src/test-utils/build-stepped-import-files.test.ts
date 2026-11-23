import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createImportFiles } from '../store/create-import-files.ts';
import { buildSteppedImportFiles } from './build-stepped-import-files.ts';

test('it runs the step before each call from the given one on, and passes each call on', () => {
  const folder = createTempDir('stepped-import-files').path;
  const real = createImportFiles();
  const seen: boolean[] = [];

  const files = buildSteppedImportFiles(real, 1, () => {
    seen.push(real.exists(join(folder, 'a')));
  });

  files.writeFile(join(folder, 'a'), 'one\n', 0o600);
  files.rename(join(folder, 'a'), join(folder, 'b'));
  files.exists(join(folder, 'b'));

  expect({
    seen,
    from: real.exists(join(folder, 'a')),
    to: real.exists(join(folder, 'b')),
  }).toStrictEqual({
    seen: [true, false],
    from: false,
    to: true,
  });
});

test('it passes the calls that read and remove on', () => {
  const folder = createTempDir('stepped-import-files').path;
  const real = createImportFiles();
  const files = buildSteppedImportFiles(real, 100, () => {});

  real.writeFile(join(folder, 'a'), 'one\n', 0o600);
  real.writeFile(join(folder, 'b'), 'two\n', 0o600);

  const mode = files.readMode(join(folder, 'a'));
  const names = files.list(folder).toSorted();

  files.removeFile(join(folder, 'a'));

  expect({ mode, names, hasA: real.exists(join(folder, 'a')) }).toStrictEqual({
    mode: 0o600,
    names: ['a', 'b'],
    hasA: false,
  });
});
