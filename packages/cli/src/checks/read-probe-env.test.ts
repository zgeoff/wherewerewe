import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readProbeEnv } from './read-probe-env.ts';

function setupTest() {
  const root = createTempDir('read-probe-env').path;
  const work = join(root, 'work');

  mkdirSync(join(work, 'home'), { recursive: true });

  return {
    root,
    work,
    readGlobal: (env: Record<string, string>) =>
      readProbeEnv(env, '/usr/bin', work)['GIT_CONFIG_GLOBAL'] ?? null,
  };
}

test.each([
  { title: 'HOME', name: 'HOME' },
  { title: 'XDG_CONFIG_HOME', name: 'XDG_CONFIG_HOME' },
])(
  'it gives git an empty global config when $title names a folder in the working folder',
  (row) => {
    const ctx = setupTest();

    expect(ctx.readGlobal({ [row.name]: join(ctx.work, 'home') })).toBe('/dev/null');
  },
);

test('it leaves the global config to git when HOME is outside the working folder', () => {
  const ctx = setupTest();

  expect(ctx.readGlobal({ HOME: ctx.root })).toBeNull();
});

test('it gives git an empty config for GIT_CONFIG_GLOBAL in the working folder, and keeps one outside', () => {
  const ctx = setupTest();

  expect(ctx.readGlobal({ GIT_CONFIG_GLOBAL: join(ctx.work, 'gitconfig') })).toBe('/dev/null');

  expect(ctx.readGlobal({ GIT_CONFIG_GLOBAL: join(ctx.root, 'gitconfig') })).toBe(
    join(ctx.root, 'gitconfig'),
  );
});

test('it keeps a GIT_CONFIG_GLOBAL outside the working folder when HOME is inside it', () => {
  const ctx = setupTest();
  const global = join(ctx.root, 'gitconfig');

  expect(ctx.readGlobal({ HOME: join(ctx.work, 'home'), GIT_CONFIG_GLOBAL: global })).toBe(global);
});
