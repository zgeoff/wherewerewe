import { expect, test } from 'bun:test';
import { lstatSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { makeProbeBin } from './make-probe-bin.ts';

test('it makes a bin folder that holds only a git link, and does nothing the second time', () => {
  const root = createTempDir('probe-bin').path;
  const bin = makeProbeBin(root);
  const first = lstatSync(join(bin, 'git')).ino;
  const target = readlinkSync(join(bin, 'git'));

  makeProbeBin(root);

  expect({
    bin,
    entries: readdirSync(bin),
    isGitLink: target === Bun.which('git'),
    same: lstatSync(join(bin, 'git')).ino === first,
  }).toStrictEqual({ bin: join(root, 'bin'), entries: ['git'], isGitLink: true, same: true });
});
