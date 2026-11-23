import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, utimesSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMemoryLockFiles } from '../test-utils/build-memory-lock-files.ts';
import { buildNoStartLockFiles } from '../test-utils/build-no-start-lock-files.ts';
import { buildSteppedLockFiles } from '../test-utils/build-stepped-lock-files.ts';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { buildClaimPath } from './build-claim-path.ts';
import { createLockFiles } from './create-lock-files.ts';
import { removeLockIfUnchanged } from './remove-lock-if-unchanged.ts';
import { takeStoreLock } from './take-store-lock.ts';

function setupTest() {
  const folder = createTempDir('take-lock').path;
  const files = createLockFiles();

  return {
    folder,
    files,
    lockPath: join(folder, 'lock'),
    readLock: () => readFileSync(join(folder, 'lock'), 'utf8'),
    take: (lockPath: string) => takeStoreLock(lockPath, files, Date.now),
  };
}

test('it creates the lock with its pid and ts when there is none', () => {
  const ctx = setupTest();

  const pattern = new RegExp(`^pid=${String(process.pid)} ts=\\S+\\n$`, 'u');

  const attempt = ctx.take(ctx.lockPath);

  expect({ attempt, lock: ctx.readLock(), files: readdirSync(ctx.folder) }).toStrictEqual({
    attempt: { kind: 'taken', lock: expect.objectContaining({ content: ctx.readLock() }) },
    lock: expect.stringMatching(pattern),
    files: ['lock'],
  });
});

test('it reports the pid of a live holder and leaves its lock', () => {
  const ctx = setupTest();
  const line = `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`;

  seedStoreFile(ctx.folder, 'lock', line);

  expect({ attempt: ctx.take(ctx.lockPath), lock: ctx.readLock() }).toStrictEqual({
    attempt: { kind: 'held', pid: process.pid },
    lock: line,
  });
});

test('it takes over a lock whose pid is gone', async () => {
  const ctx = setupTest();

  const pid = await runGoneProcess();

  seedStoreFile(ctx.folder, 'lock', `pid=${String(pid)} ts=${new Date().toISOString()}\n`);

  expect(ctx.take(ctx.lockPath).kind).toBe('taken');
});

test('it takes over a lock with a live pid and a ts 31 seconds old', () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'lock',
    `pid=${String(process.pid)} ts=${new Date(Date.now() - 31_000).toISOString()}\n`,
  );

  expect(ctx.take(ctx.lockPath).kind).toBe('taken');
});

test('it leaves a lock that does not parse while the file is new, and reports no pid', () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'lock', 'half a write');

  expect(ctx.take(ctx.lockPath)).toStrictEqual({ kind: 'held', pid: null });
});

test('it takes over a lock that does not parse once the file is 31 seconds old', () => {
  const ctx = setupTest();
  const oldS = (Date.now() - 31_000) / 1000;

  seedStoreFile(ctx.folder, 'lock', 'half a write');
  utimesSync(ctx.lockPath, oldS, oldS);

  expect(ctx.take(ctx.lockPath).kind).toBe('taken');
});

// A slow writer judges a dead writer's lock stale; from step `fromStep` of its takeover on, a fresh
// writer tries the lock before each of its file calls. The step after its read is where one fresh
// writer takes the stale lock over and the next would get in if the slow writer moved that lock.
test.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
  'it lets in exactly one writer when fresh writers try the lock before each call of a slow takeover from step %i',
  async (fromStep) => {
    const ctx = setupTest();

    const pid = await runGoneProcess();

    const kinds: string[] = [];

    seedStoreFile(ctx.folder, 'lock', `pid=${String(pid)} ts=${new Date().toISOString()}\n`);

    const files = buildSteppedLockFiles(ctx.files, fromStep, () => {
      kinds.push(ctx.take(ctx.lockPath).kind);
    });

    kinds.push(takeStoreLock(ctx.lockPath, files, Date.now).kind);

    expect({
      taken: kinds.filter((kind) => kind === 'taken').length,
      files: readdirSync(ctx.folder),
    }).toStrictEqual({ taken: 1, files: ['lock'] });
  },
);

// The holder's lock grew 31 s old, so a slow writer takes it over while the holder, still alive,
// releases it before each of the slow writer's file calls from step `fromStep` on, and a fresh
// writer then tries the lock.
test.each([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])(
  'it lets in exactly one writer when the old holder releases during a takeover of its lock from step %i',
  (fromStep) => {
    const ctx = setupTest();
    const kinds: string[] = [];

    const holderLock = seedLockFile(
      ctx.folder,
      'lock',
      `pid=${String(process.pid)} ts=${new Date(Date.now() - 31_000).toISOString()}\n`,
    );

    const files = buildSteppedLockFiles(ctx.files, fromStep, () => {
      kinds.push(
        `release ${removeLockIfUnchanged(ctx.lockPath, holderLock, ctx.files, Date.now)}`,
        ctx.take(ctx.lockPath).kind,
      );
    });

    kinds.push(takeStoreLock(ctx.lockPath, files, Date.now).kind);

    expect({
      taken: kinds.filter((kind) => kind === 'taken').length,
      files: readdirSync(ctx.folder),
    }).toStrictEqual({ taken: 1, files: ['lock'] });
  },
);

// A holder makes its lock at time t and releases it after a contender judged it stale at t + 31 s;
// the clock then goes back to t, and the holder makes a new lock on the same inode while the
// contender claims the old one.
test('it never matches a later lock of the same process to an earlier one it judged stale', () => {
  const memory = buildMemoryLockFiles();
  const tMs = Date.parse('2026-03-10T11:43:00.000Z');
  const kinds: string[] = [];

  takeStoreLock('reused-inode/lock', memory.files, () => tMs);

  const holderLock = memory.readSeen('reused-inode/lock');

  const files = buildSteppedLockFiles(memory.files, 2, () => {
    kinds.push(
      `release ${removeLockIfUnchanged('reused-inode/lock', holderLock, memory.files, () => tMs)}`,
      takeStoreLock('reused-inode/lock', memory.files, () => tMs).kind,
    );
  });

  const contender = takeStoreLock('reused-inode/lock', files, () => tMs + 31_000);

  expect({ contender: contender.kind, holder: kinds.slice(0, 2) }).toStrictEqual({
    contender: 'held',
    holder: ['release removed', 'taken'],
  });
});

test('it gives up a lock it made more than 30 seconds after its ts, so no writer takes it over under it', () => {
  const memory = buildMemoryLockFiles();
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00.000Z') };

  const files = buildSteppedLockFiles(memory.files, 0, () => {
    clock.nowMs = Date.parse('2026-03-10T11:43:31.000Z');
  });

  const slow = takeStoreLock('slow-publish/lock', files, () => clock.nowMs);

  expect({ slow, lock: memory.files.read('slow-publish/lock') }).toStrictEqual({
    slow: { kind: 'held', pid: null },
    lock: null,
  });
});

// The writer made its lock at t; before it reads the lock back, the clock steps to t + 31 s, a
// contender takes the lock over as stale, and the clock steps back to t.
test('it gives up a lock that another writer took over before it read the lock back', () => {
  const memory = buildMemoryLockFiles();
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00.000Z') };
  const contender: string[] = [];

  const files = buildSteppedLockFiles(memory.files, 1, () => {
    clock.nowMs = Date.parse('2026-03-10T11:43:31.000Z');

    contender.push(takeStoreLock('paused-publish/lock', memory.files, () => clock.nowMs).kind);

    clock.nowMs = Date.parse('2026-03-10T11:43:00.000Z');
  });

  const writer = takeStoreLock('paused-publish/lock', files, () => clock.nowMs);

  expect({ writer, contender }).toStrictEqual({
    writer: { kind: 'held', pid: null },
    contender: ['taken'],
  });
});

// A system with no /proc shows no start time, so a claim whose pid a later, live process got cannot
// be told from a live claimer until it is past the stale age.
test.each([
  [10_000, 'held'],
  [31_000, 'taken'],
] as const)(
  'it takes over a stale lock past a claim of a running pid with no start time %i ms old: %s',
  async (ageMs, kind) => {
    const ctx = setupTest();

    const pid = await runGoneProcess();

    const seen = seedLockFile(
      ctx.folder,
      'lock',
      `pid=${String(pid)} ts=${new Date().toISOString()}\n`,
    );

    seedLockFile(
      ctx.folder,
      basename(buildClaimPath(ctx.lockPath, seen)),
      `pid=${String(process.pid)} ts=${new Date(Date.now() - ageMs).toISOString()}\n`,
    );

    expect(takeStoreLock(ctx.lockPath, buildNoStartLockFiles(ctx.files), Date.now).kind).toBe(kind);
  },
);
