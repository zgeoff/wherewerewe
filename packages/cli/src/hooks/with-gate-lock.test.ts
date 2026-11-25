import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { withGateLock } from './with-gate-lock.ts';

function setupTest() {
  const folder = createTempDir('gate-lock').path;

  return {
    gatePath: join(folder, 'claude-9e1f-trial'),
    options: { waitMs: 200, sleep: () => Promise.resolve() },
  };
}

test('it runs the callback and returns its value', async () => {
  const ctx = setupTest();

  const result = await withGateLock(ctx.gatePath, () => Promise.resolve(7), ctx.options);

  expect(result).toStrictEqual({ kind: 'ran', value: 7 });
});

test('it makes a second taker wait for the first, and runs them one after the other', async () => {
  const ctx = setupTest();
  const events: string[] = [];
  const release = Promise.withResolvers<undefined>();
  const held = Promise.withResolvers<undefined>();
  const tried = Promise.withResolvers<undefined>();

  const first = withGateLock(
    ctx.gatePath,
    async () => {
      held.resolve(undefined);

      await release.promise;

      events.push('first');
    },
    ctx.options,
  );

  await held.promise;

  const second = withGateLock(
    ctx.gatePath,
    () => {
      events.push('second');

      return Promise.resolve();
    },
    {
      waitMs: 2000,
      sleep: () => {
        tried.resolve(undefined);

        return Promise.resolve();
      },
    },
  );

  await tried.promise;

  release.resolve(undefined);

  await Promise.all([first, second]);

  expect(events).toStrictEqual(['first', 'second']);
});

test('it reports busy when the lock is held past the wait', async () => {
  const ctx = setupTest();
  const release = Promise.withResolvers<undefined>();
  const held = Promise.withResolvers<undefined>();

  const first = withGateLock(
    ctx.gatePath,
    async () => {
      held.resolve(undefined);

      await release.promise;
    },
    ctx.options,
  );

  await held.promise;

  const second = await withGateLock(ctx.gatePath, () => Promise.resolve(1), {
    ...ctx.options,
    waitMs: 40,
  });

  release.resolve(undefined);

  await first;

  expect(second).toStrictEqual({ kind: 'busy' });
});

test('it frees the lock when the callback throws', async () => {
  const ctx = setupTest();

  const thrown = await withGateLock(
    ctx.gatePath,
    () => {
      throw new Error('stopped');
    },
    ctx.options,
  ).catch((error: unknown) => error);

  expect(thrown).toStrictEqual(new Error('stopped'));

  const after = await withGateLock(ctx.gatePath, () => Promise.resolve(1), ctx.options);

  expect(after).toStrictEqual({ kind: 'ran', value: 1 });
});
