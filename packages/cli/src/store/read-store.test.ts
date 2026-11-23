import { expect, test } from 'bun:test';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { readStore } from './read-store.ts';
import { writeOwnerFiles } from './write-owner-files.ts';

function setupTest() {
  const root = createTempDir('read-store').path;

  return { root, folder: join(root, 'tide-alerts') };
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
  ['a newer format', 'format=2\n', { kind: 'newer', format: '2' }],
  [
    'a broken session',
    'format=1\ncolour=red\n',
    {
      kind: 'broken',
      file: 'session',
      line: null,
      reason: 'the key colour is not in format 1',
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
  const env = { XDG_STATE_HOME: ctx.root };

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
OWNER SAYS (1) · act on it; only the owner clears it
  o-1  Ask me first  [43m]
NOW  none. Run: www now <id> "<next step>"
Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.
Close with www done <id> --evidence "<PR, commit or test run>" or www drop <id> --why "<reason>".
More: www help · www show <id> · www log --since 24h · www decide "<choice>" --why "<reason>"
`,
      stderr:
        "www: tide-alerts's owner.tsv line 3 does not parse: expected 4 tab-separated columns, found 2. The brief leaves out what it could not read. Fix the file by hand.\n",
    },
    task: { exitCode: 0, stdout: 't-a  task, open, no check. Brief: 10 lines.\n', stderr: '' },
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
