import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readSavedBrief } from './read-saved-brief.ts';
import { seedItems } from './seed-items.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  const root = createTempDir('read-saved-brief').path;

  return {
    root,
    folder: join(root, 'tide-alerts'),
    read: (folder: string) =>
      readSavedBrief(folder, {
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        sessionFlag: null,
        host: null,
      }),
  };
}

test('it renders the saved store with the header of a brief that ran no check', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItems(ctx.folder, [{ id: 't-a', claim: 'Write it', check: 'pid:4', last: 'alive' }]);

  const brief = await ctx.read(ctx.folder);

  expect(brief.split('\n')[0]).toBe(
    'tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write never · 1 checks, not run yet',
  );
});

test('it fails for a folder with no store', async () => {
  const ctx = setupTest();

  await expect(ctx.read(join(ctx.root, 'none'))).toReject();
});
