import { join } from 'node:path';
import { journalHeader } from '../store/constants.ts';
import { formatItemsFile } from '../store/format-items-file.ts';
import { formatJournalRows } from '../store/format-journal-rows.ts';
import { formatLessonsFile } from '../store/format-lessons-file.ts';
import { formatNotesFile } from '../store/format-notes-file.ts';
import { formatOwnerFile } from '../store/format-owner-file.ts';
import { formatPromisesFile } from '../store/format-promises-file.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { formatSessionFile } from '../store/format-session-file.ts';
import { formatWordsFile } from '../store/format-words-file.ts';
import type { Item } from '../types.ts';
import { seedStoreFile } from './seed-store-file.ts';

// The plain text of each cell a --json read prints, by the name a cell has in
// build-json-redaction-cases.ts.
export const plainCells: Readonly<Record<string, string>> = {
  'task id': 't-a',
  'task claim': 'Write the parser',
  'task check': 'path:/work/parser-notes',
  'task blocked by': 'w-z',
  'task pid start': '1700000000',
  note: 'Read the tests first',
  'wait id': 'w-a',
  'wait claim': 'The staging key',
  'wait who': 'wren',
  'wait check': 'path:/work/staging-key',
  'wait at write': 'exists at write',
  'approval quote': 'Merge when CI is green',
  'approval who': 'jo',
  'approval where': 'slack',
  'approval scope': 'in the sailing app',
  'rule claim': 'Show depths in metres',
  'rule written': '2026-03-09T16:20:00Z',
  'where claim': 'The chart API lives in the sailing app',
  goal: 'Ship the tide chart',
  pin: 'Keep alerts plain',
  'next step': 'run the tests',
  'owner note': 'Ask before you merge',
  'owner note on': 't-q',
  'lesson id': 'l-a',
  'lesson text': 'Reseed the table',
  'lesson why': 'A stale row passed',
  'promise id': 'p-a',
  'promise what': 'The cost table',
  'promise to': 'sam',
  'promise by': 'Friday',
  'words id': 'w-b',
  words: 'Keep PRs small',
  'words where': 'chat',
  'decision id': 'd-1',
  'decision ts': '2026-03-10T09:05:00Z',
  'decision choice': 'Use UTC',
  'decision why': 'The feed sends UTC',
  'decision extra': 'on=r-a;who=agent',
  'close id': 't-z',
  'close ts': '2026-03-10T10:30:00Z',
  'close text': 'commit 4c1d2e0',
  'close why': 'the parser ships',
  'close extra': 'who=agent',
  'pr ref': 'acme/tide-app#9',
  'journal op': 'remark',
  'journal id': 'ok-a',
  'session name': 'tide-alerts',
};

// Writes the session of the cell `session name` by hand, a row in every file and a value in every
// field a --json read prints, each cell its plain text or the one `cells` gives. A write refuses a
// credential, so the files are made directly. Returns the session folder.
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
    grant: {
      may: ['merge the chart PRs'],
      not: ['change the API'],
      never: ['publish a release'],
      scope: 'within the chart work',
      where: 'standup',
      reading: 'covers merges of chart PRs; kept back: releases',
      set: '2026-03-10T09:30:00Z',
    },
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
    item({
      id: cell('task id'),
      kind: 'task',
      claim: cell('task claim'),
      check: cell('task check'),
      atWrite: 'missing',
      last: 'missing',
      extra: { blocked_by: cell('task blocked by') },
    }),

    // no process has this pid, so each read finds it gone, as it was at write
    item({
      id: 't-b',
      kind: 'task',
      claim: 'Tune the tide cache',
      check: 'pid:2147483647',
      atWrite: 'gone',
      last: 'gone',
      extra: { pid_start: cell('task pid start') },
    }),

    // the check found the path at write, and this read finds it gone, so the item changed
    item({
      id: cell('wait id'),
      kind: 'wait',
      claim: cell('wait claim'),
      check: cell('wait check'),
      atWrite: cell('wait at write'),
      last: 'exists',
      extra: { who: cell('wait who') },
    }),
    item({
      id: 'w-c',
      kind: 'wait',
      claim: 'The deploy box is free',
      check: 'pid:2147483647',
      atWrite: 'gone',
      last: 'gone',
      extra: { who: 'kim', pid_start: '1800000002' },
    }),

    // set gives an approval a check, which the ok command itself takes no flag for
    item({
      id: 'ok-a',
      kind: 'ok',
      claim: cell('approval quote'),
      check: 'pid:2147483647',
      atWrite: 'gone',
      last: 'gone',
      extra: { ...approvalExtra, pid_start: '1800000003' },
    }),
    item({
      id: 'r-a',
      kind: 'rule',
      claim: cell('rule claim'),
      written: cell('rule written'),
    }),
    item({
      id: 'wh-a',
      kind: 'where',
      claim: cell('where claim'),
      check: 'pid:2147483647',
      atWrite: 'gone',
      last: 'gone',
      extra: { pid_start: '1800000004' },
    }),
  ]);

  const note = { id: cell('task id'), owed: false, written, note: cell('note') };

  // older notes on the rule, the approval, a wait and a where, so the recap prints their cells after
  // the task's
  const ruleNote = {
    id: 'r-a',
    owed: false,
    written: '2026-03-10T09:00:00Z',
    note: 'Cite the spec',
  };

  const approvalNote = {
    id: 'ok-a',
    owed: false,
    written: '2026-03-10T08:00:00Z',
    note: 'Ask jo first',
  };

  const waitNote = {
    id: 'w-c',
    owed: false,
    written: '2026-03-10T07:30:00Z',
    note: 'Ping kim at noon',
  };

  const whereNote = {
    id: 'wh-a',
    owed: false,
    written: '2026-03-10T07:00:00Z',
    note: 'Stop it with the kill switch',
  };

  const lesson = {
    id: cell('lesson id'),
    text: cell('lesson text'),
    why: cell('lesson why'),
    written,
    by: 'agent' as const,
  };

  const promise = {
    id: cell('promise id'),
    what: cell('promise what'),
    to: cell('promise to'),
    byWhen: cell('promise by'),
    written,
    by: 'agent' as const,
  };

  const words = {
    id: cell('words id'),
    words: cell('words'),
    where: cell('words where'),
    written,
    by: 'owner' as const,
  };

  const decision = {
    ts: cell('decision ts'),
    op: 'decide',
    id: cell('decision id'),
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
    extra: 'check=pid:2147483647',
  };

  const close = {
    ts: cell('close ts'),
    op: 'done',
    id: cell('close id'),
    by: 'agent' as const,
    text: cell('close text'),
    why: cell('close why'),
    extra: cell('close extra'),
  };

  // later than the close, so the log and the recap keep the rows above first; each item and file
  // row gets a row of its own write, and each item kind a ruled-out decision on it
  const ownRows = [
    { op: 'task', id: 't-b', text: 'Tune the cache', why: null, extra: 'check=pid:2147483647' },
    { op: 'wait', id: 'w-c', text: 'The deploy box', why: null, extra: 'who=kim' },
    { op: 'note', id: 'r-a', text: 'Cite the old spec', why: null, extra: 'owed=1' },
    { op: 'set', id: 'wh-a', text: 'The chart API', why: null, extra: 'check=pid:2147483647' },
    { op: 'lesson', id: cell('lesson id'), text: 'Reseed it', why: 'A row passed', extra: null },
    {
      op: 'promise',
      id: cell('promise id'),
      text: 'The costs',
      why: null,
      extra: 'to=sam;by=Friday',
    },
    { op: 'grant', id: 'grant', text: 'may: merge', why: 'covers merges', extra: 'where=standup' },
    ...['t-b', 'w-c', 'ok-a', 'wh-a'].map((on, index) => ({
      op: 'ruled-out',
      id: `d-${String(index + 2)}`,
      text: `Skip the check on ${on}`,
      why: 'It costs a probe',
      extra: `on=${on};who=agent`,
    })),
  ].map((row, index) => ({
    ts: `2026-03-10T10:${String(40 + index)}:00Z`,
    op: row.op,
    id: row.id,
    by: 'agent' as const,
    text: row.text,
    why: row.why,
    extra: row.extra,
  }));

  const wordsRow = {
    ts: '2026-03-10T10:39:00Z',
    op: 'words',
    id: cell('words id'),
    by: 'owner' as const,
    text: 'Keep the PRs small',
    why: null,
    extra: 'where=chat',
  };

  const ownerNote = {
    id: 'o-1',
    text: cell('owner note'),
    said: '2026-03-10T09:40:12Z',
    on: cell('owner note on'),
  };

  const pullRequest = {
    ref: cell('pr ref'),
    opened: '2026-03-10T08:43:00Z',
    state: 'OPEN' as const,
    seen: '2026-03-10T09:00:00Z',
  };

  seedStoreFile(folder, 'session', session);
  seedStoreFile(folder, 'items.tsv', items);

  seedStoreFile(
    folder,
    'notes.tsv',
    formatNotesFile([
      note,
      ruleNote,
      approvalNote,
      waitNote,
      whereNote,
      { id: 't-b', owed: false, written: '2026-03-10T06:00:00Z', note: 'Clear the old cache' },
    ]),
  );

  seedStoreFile(folder, 'lessons.tsv', formatLessonsFile([lesson]));
  seedStoreFile(folder, 'promises.tsv', formatPromisesFile([promise]));
  seedStoreFile(folder, 'words.tsv', formatWordsFile([words]));
  seedStoreFile(folder, 'pin', `${cell('pin')}\n`);

  seedStoreFile(
    folder,
    'journal.tsv',
    `${journalHeader}\n${formatJournalRows([decision, other, close, wordsRow, ...ownRows])}`,
  );

  seedStoreFile(folder, 'prs.tsv', formatPrsFile([pullRequest]));
  seedStoreFile(folder, 'owner.tsv', formatOwnerFile([ownerNote]));

  return folder;
}
