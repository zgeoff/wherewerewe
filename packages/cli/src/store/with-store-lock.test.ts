import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildNoStartLockFiles } from '../test-utils/build-no-start-lock-files.ts';
import { seedStaleLock } from '../test-utils/seed-stale-lock.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { createLockFiles } from './create-lock-files.ts';
import { withStoreLock } from './with-store-lock.ts';

function setupTest() {
  const folder = createTempDir('store-lock').path;

  return {
    folder,
    lockPath: join(folder, 'lock'),
  };
}

test('it holds a lock file with pid and ts while the callback runs, and removes it after', async () => {
  const ctx = setupTest();

  const result = await withStoreLock(ctx.folder, () => {
    const text = readFileSync(ctx.lockPath, 'utf8');

    return Promise.resolve(text);
  });

  const pattern = new RegExp(`^pid=${String(process.pid)} ts=\\S+\\n$`, 'u');

  expect(result).toStrictEqual({ kind: 'ran', value: expect.stringMatching(pattern) });
  expect(existsSync(ctx.lockPath)).toBe(false);
});

test('it reports busy with the holder pid when a live holder keeps the lock past the wait', async () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

  const result = await withStoreLock(ctx.folder, () => Promise.resolve('never'), { waitMs: 100 });

  expect(result).toStrictEqual({ kind: 'busy', pid: process.pid });
});

test('it reports busy with no pid when the lock file does not parse', async () => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'lock', 'half a write');

  const result = await withStoreLock(ctx.folder, () => Promise.resolve('never'), { waitMs: 100 });

  expect(result).toStrictEqual({ kind: 'busy', pid: null });
});

test('it takes over a lock whose pid is gone', async () => {
  const ctx = setupTest();

  await seedStaleLock(ctx.folder);

  const result = await withStoreLock(ctx.folder, () => Promise.resolve('ran'), { waitMs: 500 });

  expect(result).toStrictEqual({ kind: 'ran', value: 'ran' });
});

test('it takes over a lock with a live pid and a ts 31 seconds old', async () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'lock',
    `pid=${String(process.pid)} ts=${new Date(Date.now() - 31_000).toISOString()}\n`,
  );

  const result = await withStoreLock(ctx.folder, () => Promise.resolve('ran'), { waitMs: 500 });

  expect(result).toStrictEqual({ kind: 'ran', value: 'ran' });
});

test('it removes the lock when the callback throws', async () => {
  const ctx = setupTest();
  const result = withStoreLock(ctx.folder, () => Promise.reject(new Error('boom')));

  const settled = await Promise.allSettled([result]);

  expect(settled.map((outcome) => outcome.status)).toStrictEqual(['rejected']);
  expect(existsSync(ctx.lockPath)).toBe(false);
});

test('it leaves a lock that another holder took during the callback', async () => {
  const ctx = setupTest();
  const otherHolder = `pid=${String(process.pid)} ts=2030-01-01T00:00:00.000Z\n`;

  await withStoreLock(ctx.folder, () => {
    writeFileSync(ctx.lockPath, otherHolder);

    return Promise.resolve();
  });

  expect(readFileSync(ctx.lockPath, 'utf8')).toBe(otherHolder);
});

test('it makes a second writer wait until the first releases the lock', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();
  const order: string[] = [];
  const first = withStoreLock(ctx.folder, () => released.promise);

  await waitFor(() => readFileSync(ctx.lockPath));

  const second = withStoreLock(ctx.folder, () => {
    order.push('second ran');

    return Promise.resolve();
  });

  order.push('first released');
  released.resolve(undefined);

  await Promise.all([first, second]);

  expect(order).toStrictEqual(['first released', 'second ran']);
});

test('it runs one writer at a time when many start together over a stale lock', async () => {
  const ctx = setupTest();

  await seedStaleLock(ctx.folder);

  const state = { running: 0, mostRunning: 0 };

  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      withStoreLock(ctx.folder, async () => {
        state.running += 1;
        state.mostRunning = Math.max(state.mostRunning, state.running);

        await Promise.resolve();

        state.running -= 1;
      }),
    ),
  );

  expect({
    kinds: results.map((result) => result.kind),
    mostRunning: state.mostRunning,
  }).toStrictEqual({ kinds: Array.from({ length: 8 }, () => 'ran'), mostRunning: 1 });
});

test('it takes over a stale lock and removes its own when the system shows no start time', async () => {
  const ctx = setupTest();

  seedStoreFile(
    ctx.folder,
    'lock',
    `pid=${String(process.pid)} ts=${new Date(Date.now() - 31_000).toISOString()}\n`,
  );

  const result = await withStoreLock(ctx.folder, () => Promise.resolve('ran'), {
    files: buildNoStartLockFiles(createLockFiles()),
  });

  expect({ result, left: readdirSync(ctx.folder) }).toStrictEqual({
    result: { kind: 'ran', value: 'ran' },
    left: [],
  });
});
