import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  return { root: createTempDir('seed-store').path };
}

test('it makes a readable store with no items and returns its folder', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');
  const read = await readStore(folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder,
      session: expect.objectContaining({ name: 'tide-alerts', format: '2' }),
      items: [],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      ownerUnread: null,
    },
  });
});
