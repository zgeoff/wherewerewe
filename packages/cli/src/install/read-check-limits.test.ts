import { expect, test } from 'bun:test';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { readCheckLimits } from './read-check-limits.ts';

function setupTest() {
  const root = createTempDir('read-check-limits').path;
  const work = join(root, 'work');
  const bin = join(root, 'bin');

  mkdirSync(work);

  return {
    race: 'a repo that adds a filter to its own config while a check runs can still run it once.',
    root,
    work,
    bin,

    // a PATH of one folder that holds a git printing the version; the folder is the user's own, so
    // the line about a writable entry is left out
    readWithGit: (version: string) => {
      seedStubCommand(bin, 'git', `echo "git version ${version}"`);

      return readCheckLimits({ PATH: bin }, work, root).filter(
        (line) => !line.includes('you can write'),
      );
    },
  };
}

test('it names the race and each version limit of a git older than 2.36', () => {
  const ctx = setupTest();

  expect(ctx.readWithGit('2.30.1')).toStrictEqual([
    ctx.race,
    'git 2.30.1 is older than 2.45, so a check leans on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch.',
    'git 2.30.1 is older than 2.36, so it reads core.fsmonitor=false as the name of a helper program.',
  ]);
});

test('it names the lazy fetch limit alone for a git from 2.36 to 2.44', () => {
  const ctx = setupTest();

  expect(ctx.readWithGit('2.40.0')).toStrictEqual([
    ctx.race,
    'git 2.40.0 is older than 2.45, so a check leans on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch.',
  ]);
});

test('it names only the race for a git of 2.45 or later', () => {
  const ctx = setupTest();

  expect(ctx.readWithGit('2.55.0')).toStrictEqual([ctx.race]);
});

test('it names a PATH entry the user can write, and one inside the working folder', () => {
  const ctx = setupTest();
  const inside = join(ctx.work, 'tools');

  mkdirSync(inside);

  const owner = join(ctx.root, 'owner-bin');

  mkdirSync(owner);

  expect(readCheckLimits({ PATH: `${inside}:${owner}` }, ctx.work, ctx.root)).toStrictEqual([
    '~/work/tools is inside the folder you ran install in, so checks skip it and find no git or gh there.',
    '~/owner-bin is on PATH and you can write to it, so a git or gh an agent plants there runs from a check.',
  ]);
});

test('it names nothing when no git is on PATH and no entry can be written', () => {
  const ctx = setupTest();

  expect(
    readCheckLimits({ PATH: join(ctx.root, 'no-such-folder') }, ctx.work, ctx.root),
  ).toStrictEqual([]);
});

test('it names the race and the unknown version when git prints no version it can read', () => {
  const ctx = setupTest();

  expect(ctx.readWithGit('unreadable')).toStrictEqual([
    ctx.race,
    'the version of git could not be read, so a git older than 2.45 may lean on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch, and one older than 2.36 reads core.fsmonitor=false as the name of a helper program.',
  ]);
});

test('it names the unknown version when git is found but fails to start', () => {
  const ctx = setupTest();

  mkdirSync(ctx.bin);
  writeFileSync(join(ctx.bin, 'git'), '#!/no/such/interpreter\n');
  chmodSync(join(ctx.bin, 'git'), 0o755);

  expect(
    readCheckLimits({ PATH: ctx.bin }, ctx.work, ctx.root).filter(
      (line) => !line.includes('you can write'),
    ),
  ).toStrictEqual([
    ctx.race,
    'the version of git could not be read, so a git older than 2.45 may lean on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch, and one older than 2.36 reads core.fsmonitor=false as the name of a helper program.',
  ]);
});

test('it names each config folder in the environment that the user can write', () => {
  const ctx = setupTest();
  const configs = join(ctx.root, 'configs');
  const gh = join(ctx.root, 'gh-config');

  mkdirSync(configs);
  mkdirSync(gh);

  const env = { HOME: ctx.root, XDG_CONFIG_HOME: configs, GH_CONFIG_DIR: gh };

  expect(readCheckLimits(env, ctx.work, ctx.root)).toStrictEqual([
    'HOME names ~, which you can write to, so a git or gh config an agent writes there is read by a check.',
    'XDG_CONFIG_HOME names ~/configs, which you can write to, so a git or gh config an agent writes there is read by a check.',
    'GH_CONFIG_DIR names ~/gh-config, which you can write to, so a git or gh config an agent writes there is read by a check.',
  ]);
});
