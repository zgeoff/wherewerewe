import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readJournalRows } from '../store/read-journal-rows.ts';
import { readStore } from '../store/read-store.ts';
import { seedRedactionStore } from './seed-redaction-store.ts';
import { seedSessionStore } from './seed-session-store.ts';

function setupTest() {
  const root = createTempDir('seed-redaction').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it seeds a lesson, a promise, the owner words and a decision, each text from the values or a plain one', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedRedactionStore(ctx.folder, { 'lesson why': 'why value', 'decision choice': 'choice' });

  const read = await readStore(ctx.folder);

  const store = read.kind === 'store' ? read.store : null;

  const rows = await readJournalRows(ctx.folder, () => true);

  expect({
    lessons: store?.lessons.map((row) => [row.id, row.text, row.why]),
    promises: store?.promises.map((row) => [row.id, row.what, row.to, row.byWhen]),
    words: store?.words.map((row) => [row.id, row.words, row.where]),
    journal: rows.map((row) => [row.op, row.id, row.text]),
  }).toStrictEqual({
    lessons: [['l-1', 'Reseed the table', 'why value']],
    promises: [
      ['p-1', 'The cost table', 'owner', 'Friday'],
      ['p-2', 'The alert fan-out', 'owner', 'day 12'],
    ],
    words: [['w-1', 'Plain words in every reply', 'chat']],
    journal: expect.arrayContaining([
      ['lesson', 'l-1', 'Reseed the table'],
      ['promise', 'p-1', 'The cost table'],
      ['words', 'w-1', 'Plain words in every reply'],
      ['decide', 'd-1', 'choice'],
    ]),
  });
});
