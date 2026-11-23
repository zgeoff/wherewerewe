import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readBinding } from './read-binding.ts';
import { writeBinding } from './write-binding.ts';

function setupTest() {
  return { root: join(createTempDir('read-binding').path, 'wherewerewe') };
}

test('it reads the session name a binding holds', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'alpha-notes');

  const name = await readBinding(ctx.root, { harness: 'claude', id: 'a1' });

  expect(name).toBe('alpha-notes');
});

test('it reads null for an agent with no binding', async () => {
  const ctx = setupTest();

  const name = await readBinding(ctx.root, { harness: 'claude', id: 'a1' });

  expect(name).toBeNull();
});

test('it keeps the claude and codex bindings of one id apart', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'same' }, 'alpha-notes');

  const name = await readBinding(ctx.root, { harness: 'codex', id: 'same' });

  expect(name).toBeNull();
});
