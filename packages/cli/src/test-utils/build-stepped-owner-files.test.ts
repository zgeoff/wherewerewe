import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createOwnerFiles } from '../store/create-owner-files.ts';
import { buildSteppedOwnerFiles } from './build-stepped-owner-files.ts';

test('it runs the step before each call from the given one on, and passes each call on', () => {
  const folder = createTempDir('stepped-owner-files').path;
  const seen: string[] = [];

  const files = buildSteppedOwnerFiles(createOwnerFiles(), 1, () => {
    seen.push('step');
  });

  files.append(join(folder, 'journal.tsv'), 'one\n');

  const temporaryPath = files.writeTemporary(join(folder, 'owner.tsv'), 'two\n');

  files.rename(temporaryPath, join(folder, 'owner.tsv'));

  expect({
    seen,
    journal: readFileSync(join(folder, 'journal.tsv'), 'utf8'),
    owner: readFileSync(join(folder, 'owner.tsv'), 'utf8'),
  }).toStrictEqual({ seen: ['step', 'step'], journal: 'one\n', owner: 'two\n' });
});
