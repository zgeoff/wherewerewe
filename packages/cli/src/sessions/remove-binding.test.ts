import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readBinding } from './read-binding.ts';
import { removeBinding } from './remove-binding.ts';
import { writeBinding } from './write-binding.ts';

function setupTest() {
  return { root: join(createTempDir('remove-binding').path, 'wherewerewe') };
}

test('it removes a binding and says it was there', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'alpha-notes');

  const removed = await removeBinding(ctx.root, { harness: 'claude', id: 'a1' });
  const name = await readBinding(ctx.root, { harness: 'claude', id: 'a1' });

  expect([removed, name]).toStrictEqual([true, null]);
});

test('it says there was nothing to remove for an agent with no binding', async () => {
  const ctx = setupTest();

  const removed = await removeBinding(ctx.root, { harness: 'claude', id: 'a1' });

  expect(removed).toBe(false);
});
