import { expect, test } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { runRecapCommand } from './run-recap-command.ts';

async function setupTest() {
  const stateRoot = join(createTempDir('run-recap-command').path, 'wherewerewe');

  const folder = await seedSessionStore(stateRoot, 'tide-alerts');

  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  return {
    folder,
    runRecap: async (argv: readonly string[]) => {
      const read = await readStore(folder);

      if (read.kind !== 'store') {
        throw new Error(`no store in ${folder}`);
      }

      return runRecapCommand(read.store, buildParsedArgs(argv), { nowMs, cwd: '/' }, null);
    },
  };
}

test('it reads the last 24 hours when --since is left out', async () => {
  const ctx = await setupTest();

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-09T11:00:00Z',
    op: 'done',
    id: 't-old',
    why: 'too old',
  });

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-09T12:00:00Z',
    op: 'done',
    id: 't-new',
    why: 'merged as 0c41d2e',
  });

  const result = await ctx.runRecap(['recap']);

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    lines: [...result.stdout.split('\n').slice(0, 1), ...result.stdout.split('\n').slice(2, 4)],
  }).toStrictEqual({
    exitCode: 0,
    stderr: '',
    lines: [
      'tide-alerts · day 9 · recap since day 8 11:43Z (24h) · 1 writes',
      'CLOSED SINCE day 8 11:43Z (1)',
      '  t-new       done · merged as 0c41d2e',
    ],
  });
});

test('it reads from the start of a day with --since day-<n>', async () => {
  const ctx = await setupTest();

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-07T23:59:00Z',
    op: 'decide',
    id: 'd-1',
    text: 'before',
    why: 'r',
  });

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-08T00:00:00Z',
    op: 'decide',
    id: 'd-2',
    text: 'on the day',
    why: 'r',
  });

  const result = await ctx.runRecap(['recap', '--since', 'day-7']);

  expect(result.stdout.split('\n').slice(0, 4)).toStrictEqual([
    'tide-alerts · day 9 · recap since day 7 00:00Z (day-7) · 1 writes',
    'GRANT  none. Run: www --session tide-alerts show grant',
    'DECIDED SINCE day 7 00:00Z (1)',
    '  d-2  on the day · why: r',
  ]);
});

test('it reads from the start of the session when --since names a time before it', async () => {
  const ctx = await setupTest();

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-02T08:30:00Z',
    op: 'done',
    id: 't-first',
    why: 'e',
  });

  const result = await ctx.runRecap(['recap', '--since', '30d']);

  expect(result.stdout.split('\n').slice(0, 4)).toStrictEqual([
    'tide-alerts · day 9 · recap since day 1 08:04Z (30d) · 1 writes',
    'GRANT  none. Run: www --session tide-alerts show grant',
    'CLOSED SINCE day 1 08:04Z (1)',
    '  t-first     done · e',
  ]);
});

test.each([['soon'], ['day-100000002'], ['day-3000000'], ['99999999999999d']])(
  'it refuses a --since of %p with exit 2',
  async (since) => {
    const ctx = await setupTest();
    const result = await ctx.runRecap(['recap', '--since', since]);

    expect(result).toStrictEqual({
      exitCode: 2,
      stdout: '',
      stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www recap --since 24h\n',
    });
  },
);

test('it prints the folder name of the session in a command, never the name that session holds', async () => {
  const ctx = await setupTest();
  const read = await readStore(ctx.folder);

  if (read.kind !== 'store') {
    throw new Error(`no store in ${ctx.folder}`);
  }

  const result = await runRecapCommand(
    { ...read.store, session: { ...read.store.session, name: 'other; echo hi' } },
    buildParsedArgs(['recap']),
    { nowMs: Date.parse('2026-03-10T11:43:00Z'), cwd: '/' },
    null,
  );

  expect(result.stdout.split('\n').slice(0, 2)).toStrictEqual([
    'other; echo hi · day 9 · recap since day 8 11:43Z (24h) · 0 writes',
    'GRANT  none. Run: www --session tide-alerts show grant',
  ]);
});

test('it prints the recap and names journal.tsv on stderr when the journal cannot be read', async () => {
  const ctx = await setupTest();

  rmSync(join(ctx.folder, 'journal.tsv'));
  mkdirSync(join(ctx.folder, 'journal.tsv'));

  const result = await ctx.runRecap(['recap']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: [
      'tide-alerts · day 9 · recap since day 8 11:43Z (24h) · journal unreadable',
      'GRANT  none. Run: www --session tide-alerts show grant',
      'Whole text: www show <id>',
      'Correct: www say "<text>" [--on <id>]',
      '',
    ].join('\n'),
    stderr:
      "www: tide-alerts's journal.tsv does not parse: EISDIR. This read leaves out what it could not read. Fix the file by hand.\n",
  });
});

test('it prints what parses and names the broken row of notes.tsv on stderr', async () => {
  const ctx = await setupTest();

  await seedItem(ctx.folder, { id: 't-a', claim: 'Write it' });

  seedStoreFile(ctx.folder, 'notes.tsv', 'id\towed\twritten\tnote\nt-a\tmaybe\tnot a time\tx\n');

  const result = await ctx.runRecap(['recap']);

  expect({
    lines: result.stdout.split('\n').slice(2, 4),
    stderr: result.stderr.split('\n')[0]?.startsWith("www: tide-alerts's notes.tsv line"),
  }).toStrictEqual({
    lines: ['NOTES (0 on 1 open items) · owed first, then newest', '  other open items (1): t-a'],
    stderr: true,
  });
});
