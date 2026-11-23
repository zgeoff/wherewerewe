import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { buildSteppedOwnerFiles } from '../test-utils/build-stepped-owner-files.ts';
import { readChangedPaths } from '../test-utils/read-changed-paths.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { createOwnerFiles } from './create-owner-files.ts';
import { writeOwnerFiles } from './write-owner-files.ts';

function setupTest() {
  const root = createTempDir('write-owner-files').path;
  const stateRoot = join(root, 'wherewerewe');
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  const runAsOwner = (argv: readonly string[]) =>
    runCLI({
      argv: ['--session', 'tide-alerts', ...argv],
      env: { XDG_STATE_HOME: root },
      cwd: '/work',
      terminal: { stdin: true, stdout: true },
      now: () => {
        clock.nowMs += 1000;

        return clock.nowMs - 1000;
      },
    });

  return {
    note: { id: 'o-1', text: 'Ask me first', said: '2026-03-10T11:43:30Z', on: null },
    sayRow: {
      ts: '2026-03-10T11:43:30Z',
      op: 'say',
      id: 'o-1',
      by: 'owner',
      text: 'Ask me first',
      why: null,
      extra: null,
    } as const,
    folder: join(stateRoot, 'tide-alerts'),
    runAsOwner,
    init: () =>
      runCLI({
        argv: ['init', 'tide-alerts', '--goal', 'Ship the glaze timer'],
        env: { XDG_STATE_HOME: root },
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => clock.nowMs,
      }),
    readTree: () => readTreeHashes(stateRoot),
    readSessionFile: (name: string) => readFileSync(join(stateRoot, 'tide-alerts', name), 'utf8'),
    listFolder: () => readdirSync(join(stateRoot, 'tide-alerts')).toSorted(),
  };
}

test('it appends the journal rows and replaces owner.tsv, and changes no other file', async () => {
  const ctx = setupTest();

  await ctx.init();

  const before = await ctx.readTree();

  writeOwnerFiles(ctx.folder, { notes: [ctx.note], journal: [ctx.sayRow] });

  const after = await ctx.readTree();

  expect({
    changed: readChangedPaths(before, after),
    owner: ctx.readSessionFile('owner.tsv'),
    lastJournalRow: ctx.readSessionFile('journal.tsv').trimEnd().split('\n').at(-1),
    folder: ctx.listFolder(),
  }).toStrictEqual({
    changed: ['tide-alerts/journal.tsv', 'tide-alerts/owner.tsv'],
    owner: 'id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-10T11:43:30Z\t-\n',
    lastJournalRow: '2026-03-10T11:43:30Z\tsay\to-1\towner\tAsk me first\t-\t-',
    folder: ['items.tsv', 'journal.tsv', 'owner.tsv', 'prs.tsv', 'session'],
  });
});

test.each([
  {
    step: 0,
    journalRows: '',
    next: 'o-1',
    nextLines: 8,
    ack: 'o-1  cleared. Kept in the journal. Brief: 6 lines.\n',
  },
  { step: 1, journalRows: 'say\to-1', next: 'o-2', nextLines: 8, ack: null },
  { step: 2, journalRows: 'say\to-1', next: 'o-2', nextLines: 8, ack: null },
])('it leaves no note and uses up o-1 when a say stops before call $step', async (row) => {
  const ctx = setupTest();

  await ctx.init();

  const stopped = () => {
    writeOwnerFiles(
      ctx.folder,
      { notes: [ctx.note], journal: [ctx.sayRow] },
      buildSteppedOwnerFiles(createOwnerFiles(), row.step, () => {
        throw new Error('stopped');
      }),
    );
  };

  expect(stopped).toThrow('stopped');

  const sayRows = ctx
    .readSessionFile('journal.tsv')
    .trimEnd()
    .split('\n')
    .flatMap((line) =>
      line.split('\t')[1] === 'say' ? [line.split('\t').slice(1, 3).join('\t')] : [],
    )
    .join('|');

  const owner = ctx.readSessionFile('owner.tsv');

  const brief = await ctx.runAsOwner([]);
  const next = await ctx.runAsOwner(['say', 'Next note']);
  const ack = await ctx.runAsOwner(['ack', 'o-1']);

  expect({ sayRows, owner, brief, next, ack }).toStrictEqual({
    sayRows: row.journalRows,
    owner: 'id\ttext\tsaid\ton\n',
    brief: {
      exitCode: 0,
      stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
NOW  none. Run: www now <id> "<next step>"
Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.
Close with www done <id> --evidence "<PR, commit or test run>" or www drop <id> --why "<reason>".
More: www help · www show <id> · www log --since 24h · www decide "<choice>" --why "<reason>"
`,
      stderr: '',
    },
    next: {
      exitCode: 0,
      stdout: `${row.next}  owner note. It tops the brief until you run: www --session tide-alerts ack ${row.next}. Brief: ${String(row.nextLines)} lines.\n`,
      stderr: '',
    },
    ack:
      row.ack === null
        ? {
            exitCode: 3,
            stdout: '',
            stderr:
              'www: refused: no owner note o-1 shows. Owner notes: o-2.\nRun: www --session tide-alerts\n',
          }
        : { exitCode: 0, stdout: row.ack, stderr: '' },
  });
});

test.each([
  [0, []],
  [1, ['ack\to-1']],
  [2, ['ack\to-1']],
])(
  'it keeps the note showing, and lets a second ack clear it, when an ack stops before call %i',
  async (step, ackRows) => {
    const ctx = setupTest();

    await ctx.init();
    await ctx.runAsOwner(['say', 'Ask me first']);

    const stopped = () => {
      writeOwnerFiles(
        ctx.folder,
        { notes: [], journal: [{ ...ctx.sayRow, op: 'ack' }] },
        buildSteppedOwnerFiles(createOwnerFiles(), step, () => {
          throw new Error('stopped');
        }),
      );
    };

    expect(stopped).toThrow('stopped');

    const rows = ctx
      .readSessionFile('journal.tsv')
      .trimEnd()
      .split('\n')
      .flatMap((line) =>
        line.split('\t')[1] === 'ack' ? [line.split('\t').slice(1, 3).join('\t')] : [],
      );

    const brief = await ctx.runAsOwner([]);
    const ack = await ctx.runAsOwner(['ack', 'o-1']);

    expect({ rows, brief, ack }).toStrictEqual({
      rows: ackRows,
      brief: {
        exitCode: 0,
        stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
OWNER SAYS (1) · act on it; only the owner clears it
  o-1  Ask me first  [0m]
NOW  none. Run: www now <id> "<next step>"
Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.
Close with www done <id> --evidence "<PR, commit or test run>" or www drop <id> --why "<reason>".
More: www help · www show <id> · www log --since 24h · www decide "<choice>" --why "<reason>"
`,
        stderr: '',
      },
      ack: {
        exitCode: 0,
        stdout: 'o-1  cleared. Kept in the journal. Brief: 6 lines.\n',
        stderr: '',
      },
    });
  },
);
