import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import { seedJournalRow } from './seed-journal-row.ts';
import { seedStoreFile } from './seed-store-file.ts';

// Writes the lesson l-1, the promise p-1, the owner's words w-1 and the decision d-1 into a session
// folder by hand, each stored text from `values` by its field name, or a plain text when `values`
// leaves it out, with the journal rows their writes would add.
export async function seedRedactionStore(
  folder: string,
  values: Readonly<Record<string, string>>,
): Promise<void> {
  const written = '2026-03-09T09:00:00Z';
  const text = (name: string, plain: string) => values[name] ?? plain;
  const lesson = text('lesson text', 'Reseed the table');
  const why = text('lesson why', 'A stale row passed');
  const what = text('promise what', 'The cost table');
  const to = text('promise to', 'owner');
  const by = text('promise by', 'Friday');
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
    formatPromisesFile([{ id: 'p-1', what, to, byWhen: by, written, by: 'agent' }]),
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
