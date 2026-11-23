import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildSteppedLockFiles } from '../test-utils/build-stepped-lock-files.ts';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { buildClaimPath } from './build-claim-path.ts';
import { createLockFiles } from './create-lock-files.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import { takeStoreLock } from './take-store-lock.ts';

function setupTest() {
  const folder = createTempDir('remove-lock').path;
  const files = createLockFiles();

  return {
    folder,
    files,
    lockPath: join(folder, 'lock'),
    take: () => takeStoreLock(join(folder, 'lock'), files, Date.now()),
  };
}

test('it removes the lock it saw, and its claim', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    left: [],
  });
});

test('it leaves a lock that was written over in place since it was seen', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');

  writeFileSync(ctx.lockPath, 'pid=2 ts=2026-03-10T11:43:01.000Z\n');

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'changed',
    left: ['lock'],
  });
});

test('it reports changed when the lock is gone', () => {
  const ctx = setupTest();
  const seen = { ino: 1, content: 'pid=1 ts=2026-03-10T11:43:00.000Z\n', mtimeMs: 0 };

  expect(removeLockIfUnchanged(ctx.lockPath, seen, ctx.files)).toBe('changed');
});

test('it leaves the lock to the living writer that holds the claim to it', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const others: string[] = [];

  const files = buildSteppedLockFiles(ctx.files, 1, () => {
    others.push(removeLockIfUnchanged(ctx.lockPath, seen, ctx.files));
  });

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, files);

  expect({ removal, others, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    others: ['claimed', 'claimed', 'claimed'],
    left: [],
  });
});

test('it takes over a claim, and a claim on that claim, whose writers died', async () => {
  const ctx = setupTest();

  const pid = await runGoneProcess();

  const deadLine = `pid=${String(pid)} ts=2026-03-10T11:43:00.000Z\n`;
  const seen = seedLockFile(ctx.folder, 'lock', deadLine);
  const claimPath = buildClaimPath(ctx.lockPath, seen);
  const claim = seedLockFile(ctx.folder, basename(claimPath), deadLine);

  seedLockFile(ctx.folder, basename(buildClaimPath(claimPath, claim)), deadLine);

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    left: [],
  });
});

// The holder's lock grew 31 s old and another writer took it over. From step `fromStep` of the old
// holder's release on, a fresh writer tries the lock before each file call of that release.
test.each([0, 1, 2, 3, 4])(
  'it leaves the lock of the writer that took over, and lets no fresh writer in, from step %i of the old holder release',
  (fromStep) => {
    const ctx = setupTest();
    const kinds: string[] = [];

    const holderLock = seedLockFile(
      ctx.folder,
      'lock',
      `pid=${String(process.pid)} ts=${new Date(Date.now() - 31_000).toISOString()}\n`,
    );

    ctx.take();

    const takerLock = readFileSync(ctx.lockPath, 'utf8');

    const files = buildSteppedLockFiles(ctx.files, fromStep, () => {
      kinds.push(ctx.take().kind);
    });

    const removal = removeLockIfUnchanged(ctx.lockPath, holderLock, files);

    expect({
      removal,
      taken: kinds.filter((kind) => kind === 'taken').length,
      lock: readFileSync(ctx.lockPath, 'utf8'),
      left: readdirSync(ctx.folder),
    }).toStrictEqual({ removal: 'changed', taken: 0, lock: takerLock, left: ['lock'] });
  },
);
