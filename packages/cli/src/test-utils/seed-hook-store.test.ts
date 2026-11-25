import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readBinding } from '../sessions/read-binding.ts';
import { seedHookStore } from './seed-hook-store.ts';

function setupTest() {
  return { root: createTempDir('seed-hook-store').path };
}

test('it makes the store and binds the agent session id to it', async () => {
  const ctx = setupTest();

  await seedHookStore(ctx.root, { harness: 'claude', id: '9e1f-trial' }, 'tide-alerts');

  const name = await readBinding(ctx.root, { harness: 'claude', id: '9e1f-trial' });

  expect(name).toBe('tide-alerts');
});
