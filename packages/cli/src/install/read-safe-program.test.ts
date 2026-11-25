import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { readSafeProgram } from './read-safe-program.ts';

function setupTest() {
  const root = createTempDir('read-safe-program').path;
  const work = join(root, 'work');
  const real = join(root, 'real-bin');

  mkdirSync(work, { recursive: true });
  seedStubCommand(real, 'codex', 'echo real');

  return {
    root,
    work,
    real,
    locateIn: (path: string) => readSafeProgram('codex', { PATH: path }, work),
  };
}

test('it finds a program in an absolute folder outside the working folder', () => {
  const ctx = setupTest();

  expect(ctx.locateIn(ctx.real)).toBe(join(ctx.real, 'codex'));
});

test('it never runs or writes the program, and never resolves a link to it', () => {
  const ctx = setupTest();
  const links = join(ctx.root, 'links');

  mkdirSync(links);
  symlinkSync(join(ctx.real, 'codex'), join(links, 'codex'));

  expect(ctx.locateIn(links)).toBe(join(links, 'codex'));
});

test.each([
  { title: 'a relative entry', plantIn: 'bin', pickEntry: () => 'bin' },
  { title: 'an empty entry', plantIn: 'bin', pickEntry: () => '' },
  {
    title: 'a folder under the working folder',
    plantIn: 'tools',
    pickEntry: (work: string) => join(work, 'tools'),
  },
  { title: 'the working folder itself', plantIn: '.', pickEntry: (work: string) => work },
])('it skips $title ahead of the real folder', (row) => {
  const ctx = setupTest();

  seedStubCommand(join(ctx.work, row.plantIn), 'codex', 'echo planted');

  expect(ctx.locateIn([row.pickEntry(ctx.work), ctx.real].join(':'))).toBe(join(ctx.real, 'codex'));
});

test('it skips a link whose target is a folder under the working folder', () => {
  const ctx = setupTest();
  const links = join(ctx.root, 'sneaky');

  seedStubCommand(join(ctx.work, 'tools'), 'codex', 'echo planted');
  symlinkSync(join(ctx.work, 'tools'), links);

  expect(ctx.locateIn([links, ctx.real].join(':'))).toBe(join(ctx.real, 'codex'));
});

test('it finds nothing when only planted folders hold the program', () => {
  const ctx = setupTest();

  seedStubCommand(join(ctx.work, 'bin'), 'codex', 'echo planted');

  expect(ctx.locateIn(['bin', join(ctx.work, 'bin')].join(':'))).toBeNull();
});

test('it skips a program in a trusted folder that links to a file under the working folder', () => {
  const ctx = setupTest();
  const links = join(ctx.root, 'trusted-links');

  mkdirSync(links);
  seedStubCommand(join(ctx.work, 'tools'), 'codex', 'echo planted');
  symlinkSync(join(ctx.work, 'tools', 'codex'), join(links, 'codex'));

  expect(ctx.locateIn([links, ctx.real].join(':'))).toBe(join(ctx.real, 'codex'));
});
