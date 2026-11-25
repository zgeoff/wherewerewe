import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { findBinPath } from './find-bin-path.ts';

function setupTest() {
  const root = createTempDir('find-bin-path').path;
  const work = join(root, 'work');

  mkdirSync(work, { recursive: true });

  return { root, work };
}

test('it gives the path of a link on the PATH, not the link target', () => {
  const ctx = setupTest();
  const target = join(ctx.root, 'cellar', 'wherewerewe');
  const links = join(ctx.root, 'bin');

  seedStubCommand(join(ctx.root, 'cellar'), 'wherewerewe', 'echo 1');
  mkdirSync(links);
  symlinkSync(target, join(links, 'wherewerewe'));

  expect(findBinPath({ PATH: links }, ctx.work)).toBe(join(links, 'wherewerewe'));
});

test('it gives null when no wherewerewe is on the PATH', () => {
  const ctx = setupTest();

  expect(findBinPath({ PATH: join(ctx.root, 'empty') }, ctx.work)).toBeNull();
});

test('it never names a wherewerewe in a relative entry or under the working folder', () => {
  const ctx = setupTest();

  seedStubCommand(join(ctx.work, 'bin'), 'wherewerewe', 'echo planted');

  expect(findBinPath({ PATH: ['bin', join(ctx.work, 'bin')].join(':') }, ctx.work)).toBeNull();
});
