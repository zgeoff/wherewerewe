import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { readSessionSummaries } from './read-session-summaries.ts';
import { writeBinding } from './write-binding.ts';

function setupTest() {
  return { root: join(createTempDir('summaries').path, 'wherewerewe') };
}

test('it lists each session folder by name and skips the bindings folder', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'beta-notes');
  await seedSessionStore(ctx.root, 'alpha-notes');
  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'alpha-notes');

  const summaries = await readSessionSummaries(ctx.root);

  expect(summaries).toStrictEqual([
    {
      name: 'alpha-notes',
      format: '2',
      started: '2026-03-02T08:04:11Z',
      lastWrite: null,
      goal: 'Ship the parser with its tests',
    },
    {
      name: 'beta-notes',
      format: '2',
      started: '2026-03-02T08:04:11Z',
      lastWrite: null,
      goal: 'Ship the parser with its tests',
    },
  ]);
});

test.each([
  ['a hand-kept session', 'name=a\ngoal=b\n', '0-by-hand'],
  ['a format 1 session', 'format=1\nname=a\ngoal=b\n', '1'],
  ['a newer session', 'format=3\n', '3'],
  ['a broken session', 'format=2\ncolour=red\n', null],
])('it reads %s as format %p with no other fields', async (_title, text, format) => {
  const ctx = setupTest();

  seedStoreFile(join(ctx.root, 'old-notes'), 'session', text);

  const summaries = await readSessionSummaries(ctx.root);

  expect(summaries).toStrictEqual([
    { name: 'old-notes', format, started: null, lastWrite: null, goal: null },
  ]);
});

test('it lists nothing when the root does not exist', async () => {
  const ctx = setupTest();

  const summaries = await readSessionSummaries(ctx.root);

  expect(summaries).toStrictEqual([]);
});
