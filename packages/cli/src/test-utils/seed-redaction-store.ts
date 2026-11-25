import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import { seedJournalRow } from './seed-journal-row.ts';
import { seedStoreFile } from './seed-store-file.ts';

// Writes the lesson l-1, the promises p-1 and p-2, the owner's words w-1 and the decision d-1 into
// a session folder by hand, at the time the tests run, each text from `values` by its field name or
// a plain one, with the journal rows their writes would add.
export async function seedRedactionStore(
  folder: string,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  const written = '2026-03-10T11:43:00Z';
  const text = (name: string, plain: string) => values[name] ?? plain;
  const lesson = text('lesson text', 'Reseed the table');
  const why = text('lesson why', 'A stale row passed');
  const what = text('promise what', 'The cost table');
  const to = text('promise to', 'owner');
  const by = text('promise by', 'Friday');
  const second = text('second promise what', 'The alert fan-out');
  const words = text('words', 'Plain words in every reply');
  const where = text('words where', 'chat');

  seedStoreFile(
    folder,
    'lessons.tsv',
    formatLessonsFile([{ id: 'l-1', text: lesson, why, written, by: 'agent' }]),
  );

  seedStoreFile(
    folder,
    'promises.tsv',
    formatPromisesFile([
      { id: 'p-1', what, to, byWhen: by, written, by: 'agent' },
      { id: 'p-2', what: second, to: 'owner', byWhen: 'day 12', written, by: 'agent' },
    ]),
  );

  seedStoreFile(
    folder,
    'words.tsv',
    formatWordsFile([{ id: 'w-1', words, where, written, by: 'owner' }]),
  );

  await seedJournalRow(folder, { ts: written, op: 'lesson', id: 'l-1', text: lesson, why });

  await seedJournalRow(folder, {
    ts: written,
    op: 'promise',
    id: 'p-1',
    text: what,
    why: null,
    extra: `to=${to};by=${by}`,
  });

  await seedJournalRow(folder, {
    ts: written,
    op: 'promise',
    id: 'p-2',
    text: second,
    why: null,
    extra: 'to=owner;by=day 12',
  });

  await seedJournalRow(folder, {
    ts: written,
    op: 'words',
    id: 'w-1',
    by: 'owner',
    text: words,
    why: null,
    extra: `where=${where}`,
  });

  await seedJournalRow(folder, {
    ts: written,
    op: 'decide',
    id: 'd-1',
    text: text('decision choice', 'Keep the timer in one file'),
    why: text('decision why', 'It is small'),
    extra: 'who=agent',
  });
}
