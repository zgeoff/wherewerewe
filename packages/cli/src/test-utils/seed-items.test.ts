import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedItems } from './seed-items.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  return { root: createTempDir('seed-items').path };
}

test('it adds the items in order after the ones the store holds, with the defaults left out', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedItems(folder, [{ id: 't-a' }]);

  await seedItems(folder, [
    { id: 'w-a', kind: 'wait', extra: { who: 'owner' } },
    { id: 't-b', claim: 'Write the docs' },
  ]);

  const read = await readStore(folder);

  expect(read.kind === 'store' && read.store.items).toStrictEqual([
    expect.objectContaining({ id: 't-a', kind: 'task', claim: 'Write the parser' }),
    expect.objectContaining({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
    expect.objectContaining({ id: 't-b', kind: 'task', claim: 'Write the docs' }),
  ]);
});

test('it throws when the folder holds no store', () => {
  const ctx = setupTest();
  const seeded = seedItems(ctx.root, [{ id: 't-a' }]);

  expect(seeded).rejects.toThrow('no store to seed');
});
