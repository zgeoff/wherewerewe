import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedItem } from './seed-item.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  return { root: createTempDir('seed-item').path };
}

test('it adds items in order with the defaults the test leaves out', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');

  await seedItem(folder, { id: 't-a' });
  await seedItem(folder, { id: 'w-a', kind: 'wait', extra: { who: 'owner' } });

  const read = await readStore(folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [
        expect.objectContaining({ id: 't-a', kind: 'task', claim: 'Write the parser' }),
        expect.objectContaining({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
      ],
    },
  });
});

test('it throws when the folder holds no store', () => {
  const ctx = setupTest();
  const seeded = seedItem(ctx.root, { id: 't-a' });

  expect(seeded).rejects.toThrow('no store to seed');
});
