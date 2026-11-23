import { expect, test } from 'bun:test';
import { readFileSync, readdirSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildSteppedLockFiles } from '../test-utils/build-stepped-lock-files.ts';
import { runGoneProcess } from '../test-utils/run-gone-process.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
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
    take: (lockPath: string) => takeStoreLock(lockPath, files, Date.now()),
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
test.each([0, 1, 2, 3, 4, 5, 6, 7])(
  'it lets in exactly one writer when fresh writers try the lock before each call of a slow takeover from step %i',
  async (fromStep) => {
    const ctx = setupTest();

    const pid = await runGoneProcess();

    const kinds: string[] = [];

    seedStoreFile(ctx.folder, 'lock', `pid=${String(pid)} ts=${new Date().toISOString()}\n`);

    const files = buildSteppedLockFiles(ctx.files, fromStep, () => {
      kinds.push(ctx.take(ctx.lockPath).kind);
    });

    kinds.push(takeStoreLock(ctx.lockPath, files, Date.now()).kind);

    expect({
      taken: kinds.filter((kind) => kind === 'taken').length,
      files: readdirSync(ctx.folder),
    }).toStrictEqual({ taken: 1, files: ['lock'] });
  },
);

// The holder's lock grew 31 s old, so a slow writer takes it over while the holder, still alive,
// releases it before each of the slow writer's file calls from step `fromStep` on, and a fresh
// writer then tries the lock.
test.each([0, 1, 2, 3, 4, 5, 6, 7])(
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
        `release ${removeLockIfUnchanged(ctx.lockPath, holderLock, ctx.files)}`,
        ctx.take(ctx.lockPath).kind,
      );
    });

    kinds.push(takeStoreLock(ctx.lockPath, files, Date.now()).kind);

    expect({
      taken: kinds.filter((kind) => kind === 'taken').length,
      files: readdirSync(ctx.folder),
    }).toStrictEqual({ taken: 1, files: ['lock'] });
  },
);
