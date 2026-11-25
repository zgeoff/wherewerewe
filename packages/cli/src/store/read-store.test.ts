import { expect, test } from 'bun:test';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { readStore } from './read-store.ts';
import { writeOwnerFiles } from './write-owner-files.ts';
import { writeStoreFiles } from './write-store-files.ts';

function setupTest() {
  const root = createTempDir('read-store').path;

  return {
    root,
    folder: join(root, 'tide-alerts'),
    runAsAgent: (argv: readonly string[]) =>
      runCLI({
        argv: ['--session', 'tide-alerts', ...argv],
        env: { HOME: root, XDG_STATE_HOME: root },
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => Date.parse('2026-03-10T11:43:00Z'),
      }),
  };
}

test('it reads the session and its items', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [expect.objectContaining({ id: 't-a', claim: 'Write it' })],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
    },
  });
});

test('it reports a folder with no session file as missing', async () => {
  const ctx = setupTest();

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({ kind: 'missing' });
});

test.each([
  ['a hand-kept session', 'name=a\ngoal=b\nstarted=c\n', { kind: 'hand-kept' }],
  ['a newer format', 'format=3\n', { kind: 'newer', format: '3' }],
  ['a format 1 store', 'format=1\nname=a\n', { kind: 'format-1' }],
  [
    'a broken session',
    'format=2\ncolour=red\n',
    {
      kind: 'broken',
      file: 'session',
      line: null,
      reason: 'the key colour is not in format 2',
      partial: null,
    },
  ],
])('it reports %s without reading the items', async (_title, text, expected) => {
  const ctx = setupTest();

  seedStoreFile(ctx.folder, 'session', text);

  const read = await readStore(ctx.folder);

  const actual: unknown = read;

  expect(actual).toStrictEqual(expected);
});

test('it reports a broken items file with its line, and the store as far as it reads', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  seedStoreFile(
    ctx.folder,
    'items.tsv',
    `${readFileSync(join(ctx.folder, 'items.tsv'), 'utf8')}t-b\ttask\n`,
  );

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'broken',
    file: 'items.tsv',
    line: 3,
    reason: 'expected 9 tab-separated columns, found 2',
    partial: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [expect.objectContaining({ id: 't-a' })],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
    },
  });
});

test('it reports a missing items file with the session and no items', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  rmSync(join(ctx.folder, 'items.tsv'));

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'broken',
    file: 'items.tsv',
    line: null,
    reason: 'the file is missing',
    partial: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
    },
  });
});

test('it reads the owner notes oldest first', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  writeOwnerFiles(ctx.folder, {
    notes: [
      { id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null },
      { id: 'o-2', text: 'Use readings', said: '2026-03-10T11:05:00Z', on: 't-a' },
    ],
    journal: [],
  });

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [],
      ownerNotes: [
        { id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null },
        { id: 'o-2', text: 'Use readings', said: '2026-03-10T11:05:00Z', on: 't-a' },
      ],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
    },
  });
});

test('it reads a store with no owner file as holding no notes', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  rmSync(join(ctx.folder, 'owner.tsv'));

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [],
      ownerNotes: [],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: null,
    },
  });
});

test('it reads a broken owner file as a store with the notes that parse and the row named', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  seedStoreFile(
    ctx.folder,
    'owner.tsv',
    'id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-10T11:00:00Z\t-\no-2\tbroken\n',
  );

  const read = await readStore(ctx.folder);

  expect(read).toStrictEqual({
    kind: 'store',
    store: {
      folder: ctx.folder,
      session: expect.objectContaining({ name: 'tide-alerts' }),
      items: [],
      ownerNotes: [{ id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:00:00Z', on: null }],
      notes: [],
      notesUnread: null,
      prs: [],
      prsUnread: null,
      lessons: [],
      lessonsUnread: null,
      promises: [],
      promisesUnread: null,
      words: [],
      wordsUnread: null,
      ownerUnread: {
        file: 'owner.tsv',
        line: 3,
        reason: 'expected 4 tab-separated columns, found 2',
      },
    },
  });
});

test('it prints the brief without the broken owner row, names it on stderr, and leaves owner.tsv alone for an agent write', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root };

  const brokenText =
    'id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-10T11:00:00Z\t-\no-2\tbroken\n';

  const run = (argv: readonly string[], isTerminal: boolean) =>
    runCLI({
      argv: ['--session', 'tide-alerts', ...argv],
      env,
      cwd: '/work',
      terminal: { stdin: isTerminal, stdout: isTerminal },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  seedStoreFile(folder, 'owner.tsv', brokenText);

  const brief = await run([], false);
  const task = await run(['task', 't-a', 'Write it'], false);
  const say = await run(['say', 'Another'], true);
  const ack = await run(['ack', 'o-1'], true);

  expect({
    brief,
    task,
    say,
    ack,
    owner: readFileSync(join(folder, 'owner.tsv'), 'utf8'),
  }).toStrictEqual({
    brief: {
      exitCode: 0,
      stdout: `tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write never · no checks
GOAL  Ship the parser with its tests
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
OWNER SAYS (1) · act on it; only the owner clears it
  o-1  Ask me first  [43m]
NOW  none. Run: www now <id> "<next step>"
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr:
        "www: tide-alerts's owner.tsv line 3 does not parse: expected 4 tab-separated columns, found 2. The brief leaves out what it could not read. Fix the file by hand.\n",
    },
    task: {
      exitCode: 0,
      stdout: 't-a  task, open, no check. Brief: 182 of 20000 tokens.\n',
      stderr: '',
    },
    say: {
      exitCode: 3,
      stdout: '',
      stderr: `www: tide-alerts's owner.tsv line 3 does not parse: expected 4 tab-separated columns, found 2. Fix the row by hand.\nRun: less ${join(folder, 'owner.tsv')}\n`,
    },
    ack: {
      exitCode: 3,
      stdout: '',
      stderr: `www: tide-alerts's owner.tsv line 3 does not parse: expected 4 tab-separated columns, found 2. Fix the row by hand.\nRun: less ${join(folder, 'owner.tsv')}\n`,
    },
    owner: brokenText,
  });
});

test.each([
  {
    title: 'a credential in the id column',
    ownerText: `id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-10T11:00:00Z\t-\nAKIA${'Q'.repeat(16)}\tx\t2026-03-10T11:00:00Z\t-\n`,
    section: 'OWNER SAYS (1) · act on it; only the owner clears it\n  o-1  Ask me first  [43m]\n',
    taskTokens: 182,
    where: ' line 3',
    reason: 'the id is not o-<n>',
  },
  {
    title: 'a said that is not a time',
    ownerText: 'id\ttext\tsaid\ton\no-1\tAsk me first\tbogus\t-\n',
    section: '',
    taskTokens: 155,
    where: ' line 2',
    reason: 'the said time is not an ISO 8601 UTC time to the second, ending in Z',
  },
  {
    title: '53 rows',
    ownerText: `id\ttext\tsaid\ton\n${Array.from(
      { length: 53 },
      (_row, index) =>
        `o-${String(index + 1)}\tNote ${String(index + 1)}\t2026-03-10T11:00:00Z\t-\n`,
    ).join('')}`,
    section:
      'OWNER SAYS (2) · act on it; only the owner clears it\n  o-1  Note 1  [43m]\n  o-2  Note 2  [43m]\n',
    taskTokens: 187,
    where: ' line 4',
    reason: 'more than 2 notes',
  },
])(
  'it prints the brief with the notes that parse for $title, and still takes an agent write',
  async (row) => {
    const ctx = setupTest();

    const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

    seedStoreFile(folder, 'owner.tsv', row.ownerText);

    const brief = await ctx.runAsAgent([]);
    const task = await ctx.runAsAgent(['task', 't-a', 'Write it']);

    expect({ brief, task }).toStrictEqual({
      brief: {
        exitCode: 0,
        stdout: `tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write never · no checks
GOAL  Ship the parser with its tests
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
${row.section}NOW  none. Run: www now <id> "<next step>"
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
        stderr: `www: tide-alerts's owner.tsv${row.where} does not parse: ${row.reason}. The brief leaves out what it could not read. Fix the file by hand.\n`,
      },
      task: {
        exitCode: 0,
        stdout: `t-a  task, open, no check. Brief: ${String(row.taskTokens)} of 20000 tokens.\n`,
        stderr: '',
      },
    });
  },
);

test('it prints the brief and still takes an agent write when a folder stands in for owner.tsv', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  rmSync(join(folder, 'owner.tsv'));
  mkdirSync(join(folder, 'owner.tsv'));

  const brief = await ctx.runAsAgent([]);
  const task = await ctx.runAsAgent(['task', 't-a', 'Write it']);

  expect({ brief, task }).toStrictEqual({
    brief: {
      exitCode: 0,
      stdout: `tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write never · no checks
GOAL  Ship the parser with its tests
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
NOW  none. Run: www now <id> "<next step>"
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr:
        "www: tide-alerts's owner.tsv does not parse: the file cannot be read (EISDIR). The brief leaves out what it could not read. Fix the file by hand.\n",
    },
    task: {
      exitCode: 0,
      stdout: 't-a  task, open, no check. Brief: 155 of 20000 tokens.\n',
      stderr: '',
    },
  });
});

test('it reads a store with no notes.tsv as holding no notes', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a' });

  const read = await readStore(ctx.folder);

  expect(
    read.kind === 'store' && { notes: read.store.notes, unread: read.store.notesUnread },
  ).toStrictEqual({
    notes: [],
    unread: null,
  });
});

test('it reads two notes in file order and leaves out the note of an item that is not open', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a' });
  await seedItem(ctx.folder, { id: 't-b' });

  await writeStoreFiles(ctx.folder, {
    journal: [],
    notes: [
      { id: 't-b', owed: true, written: '2026-03-10T11:00:00Z', note: 'second item first' },
      { id: 't-gone', owed: false, written: '2026-03-10T11:01:00Z', note: 'orphan' },
      { id: 't-a', owed: false, written: '2026-03-10T11:02:00Z', note: 'first item last' },
    ],
  });

  const read = await readStore(ctx.folder);

  expect(
    read.kind === 'store' && { notes: read.store.notes, unread: read.store.notesUnread },
  ).toStrictEqual({
    notes: [
      { id: 't-b', owed: true, written: '2026-03-10T11:00:00Z', note: 'second item first' },
      { id: 't-a', owed: false, written: '2026-03-10T11:02:00Z', note: 'first item last' },
    ],
    unread: null,
  });
});

test('it reads a broken notes.tsv as a store with the notes that parse and the row it left out', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedItem(ctx.folder, { id: 't-a' });
  await seedItem(ctx.folder, { id: 't-b' });

  seedStoreFile(
    ctx.folder,
    'notes.tsv',
    'id\towed\twritten\tnote\nt-a\t-\t2026-03-10T11:00:00Z\tfine\nt-b\tmaybe\tw\tx\n',
  );

  const read = await readStore(ctx.folder);

  expect(
    read.kind === 'store' && { notes: read.store.notes, unread: read.store.notesUnread },
  ).toStrictEqual({
    notes: [{ id: 't-a', owed: false, written: '2026-03-10T11:00:00Z', note: 'fine' }],
    unread: { file: 'notes.tsv', line: 3, reason: 'the owed column is not owed or -' },
  });
});

test('it prints the brief from the notes that parse, names the broken row, and refuses each note write and close', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  await seedItem(folder, { id: 't-a' });

  const brokenText = 'id\towed\twritten\tnote\nt-a\n';

  seedStoreFile(folder, 'notes.tsv', brokenText);

  const brief = await ctx.runAsAgent([]);
  const plain = await ctx.runAsAgent(['task', 't-b', 'No note here']);
  const withNote = await ctx.runAsAgent(['task', 't-c', 'Note here', '--note', 'x']);
  const clear = await ctx.runAsAgent(['set', 't-a', '--no-note']);
  const now = await ctx.runAsAgent(['now', 't-a', 'go', '--note', 'x']);
  const done = await ctx.runAsAgent(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  const refusal = {
    exitCode: 3 as const,
    stdout: '',
    stderr: `www: tide-alerts's notes.tsv line 2 does not parse: expected 4 tab-separated columns, found 1. Fix the row by hand.\nRun: less ${join(folder, 'notes.tsv')}\n`,
  };

  expect({
    brief,
    plain,
    withNote,
    clear,
    now,
    done,
    notes: readFileSync(join(folder, 'notes.tsv'), 'utf8'),
  }).toStrictEqual({
    brief: {
      exitCode: 0,
      stdout: expect.stringContaining('  t-a         Write the parser  [no check · 1h]\n'),
      stderr:
        "www: tide-alerts's notes.tsv line 2 does not parse: expected 4 tab-separated columns, found 1. The brief leaves out what it could not read. Fix the file by hand.\n",
    },
    plain: {
      exitCode: 0,
      stdout: 't-b  task, open, no check. Brief: 173 of 20000 tokens.\n',
      stderr: '',
    },
    withNote: refusal,
    clear: refusal,
    now: refusal,
    done: refusal,
    notes: brokenText,
  });
});

test('it shows an item and prints the log from the notes that parse, and names the broken row on stderr', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  await seedItem(folder, { id: 't-a' });
  await seedItem(folder, { id: 't-b' });

  seedStoreFile(
    folder,
    'notes.tsv',
    'id\towed\twritten\tnote\nt-a\t-\t2026-03-10T11:00:00Z\tfine\nt-b\tmaybe\tw\tx\n',
  );

  const shown = await ctx.runAsAgent(['show', 't-a']);
  const logged = await ctx.runAsAgent(['log']);

  const named =
    "www: tide-alerts's notes.tsv line 3 does not parse: the owed column is not owed or -. ";

  expect({ shown, logged }).toStrictEqual({
    shown: {
      exitCode: 0,
      stdout:
        't-a  task, open since day 9, by agent\n  claim (1h): Write the parser\n  note (43m): fine\n',
      stderr: `${named}This read leaves out what it could not read. Fix the file by hand.\n`,
    },
    logged: {
      exitCode: 0,
      stdout: 'No journal rows match.\n',
      stderr: `${named}This read leaves out what it could not read. Fix the file by hand.\n`,
    },
  });
});

test('it reads the rows of prs.tsv, and no rows when the file is missing', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  seedStoreFile(
    ctx.folder,
    'prs.tsv',
    'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t2026-03-10T11:43:04Z\n',
  );

  const withRows = await readStore(ctx.folder);

  rmSync(join(ctx.folder, 'prs.tsv'));

  const withNoFile = await readStore(ctx.folder);

  expect([
    withRows.kind === 'store' && withRows.store.prs,
    withNoFile.kind === 'store' && [withNoFile.store.prs, withNoFile.store.prsUnread],
  ]).toStrictEqual([
    [
      {
        ref: 'bosunhq/bosun-app#64',
        opened: '2026-03-10T08:41:30Z',
        state: 'OPEN',
        seen: '2026-03-10T11:43:04Z',
      },
    ],
    [[], null],
  ]);
});

test('it leaves a row of prs.tsv that does not parse out, and names it, and the brief says so on stderr', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  seedStoreFile(
    folder,
    'prs.tsv',
    'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t-\nbroken row\n',
  );

  const read = await readStore(folder);
  const brief = await ctx.runAsAgent([]);

  expect([
    read.kind === 'store' && [read.store.prs.length, read.store.prsUnread],
    brief.stderr,
  ]).toStrictEqual([
    [
      1,
      {
        file: 'prs.tsv',
        line: 3,
        reason: 'expected 4 tab-separated columns, found 1',
      },
    ],
    "www: tide-alerts's prs.tsv line 3 does not parse: expected 4 tab-separated columns, found 1. The brief leaves out what it could not read. Fix the file by hand.\n",
  ]);
});

test('it leaves prs.tsv unopened when the options say so, and reads no rows of it', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(join(ctx.root, 'wherewerewe'), 'tide-alerts');

  seedStoreFile(
    folder,
    'prs.tsv',
    'ref\topened\tstate\tseen\nbosunhq/bosun-app#64\t2026-03-10T08:41:30Z\tOPEN\t-\nbroken row\n',
  );

  const read = await readStore(folder, { isPrsRead: false });

  expect(read.kind === 'store' && [read.store.prs, read.store.prsUnread]).toStrictEqual([[], null]);
});
