import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMemoryLockFiles } from '../test-utils/build-memory-lock-files.ts';
import { buildNoStartLockFiles } from '../test-utils/build-no-start-lock-files.ts';
import { buildSteppedLockFiles } from '../test-utils/build-stepped-lock-files.ts';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { buildClaimPath } from './build-claim-path.ts';
import { createLockFiles } from './create-lock-files.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import { takeStoreLock } from './take-store-lock.ts';
import type { LockFileState } from './types.ts';

function setupTest() {
  const folder = createTempDir('remove-lock').path;
  const files = createLockFiles();

  return {
    folder,
    files,
    lockPath: join(folder, 'lock'),
    take: () => takeStoreLock(join(folder, 'lock'), files, Date.now),
  };
}

test('it removes the lock it saw, and its claim', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    left: [],
  });
});

test('it leaves a lock that was written over in place since it was seen', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');

  writeFileSync(ctx.lockPath, 'pid=2 ts=2026-03-10T11:43:01.000Z\n');

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'changed',
    left: ['lock'],
  });
});

test('it reports changed when the lock is gone', () => {
  const ctx = setupTest();
  const seen = { ino: 1, content: 'pid=1 ts=2026-03-10T11:43:00.000Z\n', mtimeMs: 0 };

  expect(removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now)).toBe('changed');
});

test('it leaves the lock to the living writer that holds the claim to it', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const others: string[] = [];

  const files = buildSteppedLockFiles(ctx.files, 1, () => {
    others.push(removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now));
  });

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, files, Date.now);

  expect({ removal, others, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    others: ['claimed', 'claimed', 'claimed', 'claimed', 'claimed'],
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

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

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

    const removal = removeLockIfUnchanged(ctx.lockPath, holderLock, files, Date.now);

    expect({
      removal,
      taken: kinds.filter((kind) => kind === 'taken').length,
      lock: readFileSync(ctx.lockPath, 'utf8'),
      left: readdirSync(ctx.folder),
    }).toStrictEqual({ removal: 'changed', taken: 0, lock: takerLock, left: ['lock'] });
  },
);

test('it takes over a chain of 40 claims whose writers each died, with no name growing', async () => {
  const ctx = setupTest();

  const pid = await runGoneProcess();

  const deadLine = `pid=${String(pid)} ts=2026-03-10T11:43:00.000Z\n`;
  const seen = seedLockFile(ctx.folder, 'lock', deadLine);

  const chain = Array.from({ length: 40 }).reduce<{ path: string; seen: LockFileState }>(
    (link) => {
      const path = buildClaimPath(link.path, link.seen);

      return { path, seen: seedLockFile(ctx.folder, basename(path), deadLine) };
    },
    { path: ctx.lockPath, seen },
  );

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

  expect({ removal, chain: basename(chain.path).length }).toStrictEqual({
    removal: 'removed',
    chain: 'lock.claim-'.length + 16,
  });
});

test('it takes over a claim whose pid now belongs to a later process, once the claim is past the stale age', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');

  seedLockFile(
    ctx.folder,
    basename(buildClaimPath(ctx.lockPath, seen)),
    `pid=${String(process.pid)} ts=2026-03-10T11:43:00.000Z start=1\n`,
  );

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    left: [],
  });
});

test('it leaves a fresh claim whose pid runs with another start time, as it cannot tell a later process from the holder', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const claimName = basename(buildClaimPath(ctx.lockPath, seen));

  seedLockFile(
    ctx.folder,
    claimName,
    `pid=${String(process.pid)} ts=${new Date().toISOString()} start=1\n`,
  );

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, ctx.files, Date.now);

  expect({ removal, left: readdirSync(ctx.folder).toSorted() }).toStrictEqual({
    removal: 'claimed',
    left: ['lock', claimName],
  });
});

// The holder releases its own lock, 60 s old, while a contender that reads no start time tries the
// lock before each of the holder's file calls from its re-read of the lock on.
test('it lets a contender that cannot read the start of a live claimer in only after the claimer removed its own lock', () => {
  const ctx = setupTest();
  const kinds: string[] = [];

  const holderLock = seedLockFile(
    ctx.folder,
    'lock',
    `pid=${String(process.pid)} ts=${new Date(Date.now() - 60_000).toISOString()}\n`,
  );

  const contender = buildNoStartLockFiles(ctx.files);

  const files = buildSteppedLockFiles(ctx.files, 1, () => {
    kinds.push(takeStoreLock(ctx.lockPath, contender, Date.now).kind);
  });

  const removal = removeLockIfUnchanged(ctx.lockPath, holderLock, files, Date.now);

  expect({ removal, kinds, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    kinds: ['held', 'held', 'held', 'taken', 'held'],
    left: ['lock'],
  });
});

test('it removes the lock it saw, and throws nothing, when its claim is gone before it removes the claim', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const claimPath = buildClaimPath(ctx.lockPath, seen);

  const files = buildSteppedLockFiles(ctx.files, 4, () => {
    ctx.files.remove(claimPath);
  });

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, files, Date.now);

  expect({ removal, left: readdirSync(ctx.folder) }).toStrictEqual({
    removal: 'removed',
    left: [],
  });
});

test('it leaves the lock, and the claim of the caller that replaced its own, when its claim changed before the removal', () => {
  const ctx = setupTest();
  const seen = seedLockFile(ctx.folder, 'lock', 'pid=1 ts=2026-03-10T11:43:00.000Z\n');
  const claimPath = buildClaimPath(ctx.lockPath, seen);
  const otherClaim = 'pid=1 ts=2026-03-10T11:43:30.000Z\n';

  const files = buildSteppedLockFiles(ctx.files, 2, () => {
    ctx.files.remove(claimPath);
    ctx.files.create(claimPath, otherClaim);
  });

  const removal = removeLockIfUnchanged(ctx.lockPath, seen, files, Date.now);

  expect({
    removal,
    lock: readFileSync(ctx.lockPath, 'utf8'),
    claim: readFileSync(claimPath, 'utf8'),
  }).toStrictEqual({ removal: 'claimed', lock: seen.content, claim: otherClaim });
});

test('it leaves the lock when its own claim grew past the stale age before the removal', () => {
  const memory = buildMemoryLockFiles();
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00.000Z') };
  const seen = memory.files.create('slow-claim/lock', 'pid=1 ts=2026-03-10T11:42:00.000Z\n');

  const files = buildSteppedLockFiles(memory.files, 2, () => {
    clock.nowMs = Date.parse('2026-03-10T11:43:31.000Z');
  });

  const removal = removeLockIfUnchanged(
    'slow-claim/lock',
    memory.readSeen('slow-claim/lock'),
    files,
    () => clock.nowMs,
  );

  expect({ removal, lock: memory.files.read('slow-claim/lock') }).toStrictEqual({
    removal: 'claimed',
    lock: seen,
  });
});
