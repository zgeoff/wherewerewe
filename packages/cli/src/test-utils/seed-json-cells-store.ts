import { join } from 'node:path';
import { journalHeader, prsHeader } from '../store/constants.ts';
import { formatItemsFile } from '../store/format-items-file.ts';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatNotesFile } from '../store/format-notes-file.ts';
import { formatOwnerFile } from '../store/format-owner-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import type { Item } from '../types.ts';
import { seedStoreFile } from './seed-store-file.ts';

// The plain text of each cell a --json read prints, by the name a cell has in
// build-json-redaction-cases.ts.
export const plainCells: Readonly<Record<string, string>> = {
  'task id': 't-a',
  'task claim': 'Write the parser',
  note: 'Read the tests first',
  'wait claim': 'The staging key',
  'wait who': 'wren',
  'approval quote': 'Merge when CI is green',
  'approval who': 'jo',
  'approval where': 'slack',
  'approval scope': 'in the sailing app',
  'rule claim': 'Show depths in metres',
  'where claim': 'The chart API lives in the sailing app',
  goal: 'Ship the tide chart',
  'next step': 'run the tests',
  'owner note': 'Ask before you merge',
  'lesson text': 'Reseed the table',
  'lesson why': 'A stale row passed',
  'promise what': 'The cost table',
  'promise to': 'sam',
  'promise by': 'Friday',
  words: 'Keep PRs small',
  'words where': 'chat',
  'decision choice': 'Use UTC',
  'decision why': 'The feed sends UTC',
  'decision extra': 'on=x-fixed;who=agent',
  'journal op': 'note',
  'journal id': 'n-1',
  'session name': 'tide-alerts',
};

// Writes the session of the cell `session name` under the root's wherewerewe folder, by hand and
// with no lock. A write refuses a cell that holds a credential, so the files are made directly.
// Each cell is its plain text or the one `cells` gives. Returns the session folder.
export function seedJsonCellsStore(root: string, cells: Readonly<Record<string, string>>): string {
  const cell = (name: string): string => cells[name] ?? plainCells[name] ?? '';
  const folder = join(root, 'wherewerewe', cell('session name'));
  const written = '2026-03-10T10:31:09Z';

  const item = (fields: Partial<Item> & Pick<Item, 'id' | 'kind' | 'claim'>): Item => ({
    check: null,
    atWrite: null,
    last: null,
    written,
    by: 'agent',
    extra: {},
    ...fields,
  });

  const session = formatSessionFile({
    format: '2',
    name: cell('session name'),
    goal: cell('goal'),
    grant: null,
    started: '2026-03-02T08:04:11Z',
    now: cell('task id'),
    nowNext: cell('next step'),
    nowSet: '2026-03-10T10:43:00Z',
    lastWrite: '2026-03-10T11:02:00Z',
    lastNudge: null,
    importedFrom: null,
  });

  const approvalExtra = {
    who: cell('approval who'),
    where: cell('approval where'),
    scope: cell('approval scope'),
  };

  const items = formatItemsFile([
    item({ id: cell('task id'), kind: 'task', claim: cell('task claim') }),
    item({ id: 'w-a', kind: 'wait', claim: cell('wait claim'), extra: { who: cell('wait who') } }),
    item({ id: 'ok-a', kind: 'ok', claim: cell('approval quote'), extra: approvalExtra }),
    item({ id: 'r-a', kind: 'rule', claim: cell('rule claim') }),
    item({ id: 'wh-a', kind: 'where', claim: cell('where claim') }),
  ]);

  const note = { id: cell('task id'), owed: false, written, note: cell('note') };

  const lesson = {
    id: 'l-a',
    text: cell('lesson text'),
    why: cell('lesson why'),
    written,
    by: 'agent' as const,
  };

  const promise = {
    id: 'p-a',
    what: cell('promise what'),
    to: cell('promise to'),
    byWhen: cell('promise by'),
    written,
    by: 'agent' as const,
  };

  const words = {
    id: 'w-b',
    words: cell('words'),
    where: cell('words where'),
    written,
    by: 'owner' as const,
  };

  const decision = {
    ts: '2026-03-10T09:00:00Z',
    op: 'decide',
    id: 'd-1',
    by: 'agent' as const,
    text: cell('decision choice'),
    why: cell('decision why'),
    extra: cell('decision extra'),
  };

  const other = {
    ts: '2026-03-10T10:00:00Z',
    op: cell('journal op'),
    id: cell('journal id'),
    by: 'agent' as const,
    text: 'a row',
    why: null,
    extra: null,
  };

  const ownerNote = { id: 'o-1', text: cell('owner note'), said: '2026-03-10T09:40:12Z', on: null };

  seedStoreFile(folder, 'session', session);
  seedStoreFile(folder, 'items.tsv', items);
  seedStoreFile(folder, 'notes.tsv', formatNotesFile([note]));
  seedStoreFile(folder, 'lessons.tsv', formatLessonsFile([lesson]));
  seedStoreFile(folder, 'promises.tsv', formatPromisesFile([promise]));
  seedStoreFile(folder, 'words.tsv', formatWordsFile([words]));
  seedStoreFile(folder, 'journal.tsv', `${journalHeader}\n${formatJournalRows([decision, other])}`);
  seedStoreFile(folder, 'prs.tsv', `${prsHeader}\n`);
  seedStoreFile(folder, 'owner.tsv', formatOwnerFile([ownerNote]));

  return folder;
}
