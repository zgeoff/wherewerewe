import { expect, test } from 'bun:test';
import { chmodSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { buildSteppedOwnerFiles } from '../test-utils/build-stepped-owner-files.ts';
import { readChangedPaths } from '../test-utils/read-changed-paths.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import type { CLIResult, OwnerChange } from '../types.ts';
import { createOwnerFiles } from './create-owner-files.ts';
import { withStoreLock } from './with-store-lock.ts';
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

    // runs writeOwnerFiles inside the store lock, as say and ack do, and stops it before a call
    stopWrite: async (change: OwnerChange, step: number) => {
      try {
        await withStoreLock(join(stateRoot, 'tide-alerts'), async () => {
          await Promise.resolve();

          writeOwnerFiles(
            join(stateRoot, 'tide-alerts'),
            change,
            buildSteppedOwnerFiles(createOwnerFiles(), step, () => {
              throw new Error('stopped');
            }),
          );
        });
      } catch (error) {
        return error instanceof Error ? error.message : 'not an error';
      }

      return 'ran';
    },
    readStoppedFiles: () => ({
      journal: readFileSync(join(stateRoot, 'tide-alerts', 'journal.tsv'), 'utf8'),
      owner: readFileSync(join(stateRoot, 'tide-alerts', 'owner.tsv'), 'utf8'),
      lock: readdirSync(join(stateRoot, 'tide-alerts')).includes('lock'),
    }),
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

test.each([0o600, 0o640])('it keeps the mode %o of owner.tsv through a rewrite', async (mode) => {
  const ctx = setupTest();

  await ctx.init();

  const ownerPath = join(ctx.folder, 'owner.tsv');

  chmodSync(ownerPath, mode);

  const before = statSync(ownerPath).mode & 0o777;

  writeOwnerFiles(ctx.folder, { notes: [ctx.note], journal: [ctx.sayRow] });

  const after = statSync(ownerPath).mode & 0o777;

  expect({ before, after }).toStrictEqual({ before: mode, after: mode });
});

test.each([
  {
    step: 0,
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n',
    log: 'No journal rows match.\n',
    next: 'o-1  owner note. It tops the brief until you run: www --session tide-alerts ack o-1. Brief: 8 lines.\n',
    ack: {
      exitCode: 0,
      stdout: 'o-1  cleared. Kept in the journal. Brief: 6 lines.\n',
      stderr: '',
    } satisfies CLIResult,
  },
  ...[1, 2].map((step) => ({
    step,
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n2026-03-10T11:43:30Z\tsay\to-1\towner\tAsk me first\t-\t-\n',
    log: 'day 1  11:43  say       o-1        owner  Ask me first\n',
    next: 'o-2  owner note. It tops the brief until you run: www --session tide-alerts ack o-2. Brief: 8 lines.\n',
    ack: {
      exitCode: 3,
      stdout: '',
      stderr:
        'www: refused: no owner note o-1 shows. Owner notes: o-2.\nRun: www --session tide-alerts\n',
    } satisfies CLIResult,
  })),
])(
  'it leaves no note and uses up o-1 when a say stops before call $step, inside the lock',
  async (row) => {
    const ctx = setupTest();

    await ctx.init();

    const stopped = await ctx.stopWrite({ notes: [ctx.note], journal: [ctx.sayRow] }, row.step);

    const afterStop = ctx.readStoppedFiles();

    const brief = await ctx.runAsOwner([]);
    const log = await ctx.runAsOwner(['log', '--op', 'say']);
    const next = await ctx.runAsOwner(['say', 'Next note']);
    const ack = await ctx.runAsOwner(['ack', 'o-1']);

    expect({ stopped, afterStop, brief, log, next, ack }).toStrictEqual({
      stopped: 'stopped',
      afterStop: { journal: row.journal, owner: 'id\ttext\tsaid\ton\n', lock: false },
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
      log: { exitCode: 0, stdout: row.log, stderr: '' },
      next: { exitCode: 0, stdout: row.next, stderr: '' },
      ack: row.ack,
    });
  },
);

test.each([
  {
    step: 0,
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n2026-03-10T11:43:00Z\tsay\to-1\towner\tAsk me first\t-\t-\n',
    finalJournal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n2026-03-10T11:43:00Z\tsay\to-1\towner\tAsk me first\t-\t-\n2026-03-10T11:43:02Z\tsay\to-2\towner\tNext note\t-\t-\n2026-03-10T11:43:03Z\tack\to-1\towner\tAsk me first\t-\t-\n',
  },
  ...[1, 2].map((step) => ({
    step,
    journal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n2026-03-10T11:43:00Z\tsay\to-1\towner\tAsk me first\t-\t-\n2026-03-10T11:43:30Z\tack\to-1\towner\tAsk me first\t-\t-\n',
    finalJournal:
      'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip the glaze timer\t-\t-\n2026-03-10T11:43:00Z\tsay\to-1\towner\tAsk me first\t-\t-\n2026-03-10T11:43:30Z\tack\to-1\towner\tAsk me first\t-\t-\n2026-03-10T11:43:02Z\tsay\to-2\towner\tNext note\t-\t-\n2026-03-10T11:43:03Z\tack\to-1\towner\tAsk me first\t-\t-\n',
  })),
])(
  'it keeps the note showing and lets a second ack clear it when an ack stops before call $step, inside the lock',
  async (row) => {
    const ctx = setupTest();

    await ctx.init();
    await ctx.runAsOwner(['say', 'Ask me first']);

    const stopped = await ctx.stopWrite(
      { notes: [], journal: [{ ...ctx.sayRow, op: 'ack' }] },
      row.step,
    );

    const afterStop = ctx.readStoppedFiles();

    const brief = await ctx.runAsOwner([]);
    const next = await ctx.runAsOwner(['say', 'Next note']);
    const ack = await ctx.runAsOwner(['ack', 'o-1']);

    const afterAck = ctx.readStoppedFiles();

    expect({ stopped, afterStop, brief, next, ack, afterAck }).toStrictEqual({
      stopped: 'stopped',
      afterStop: {
        journal: row.journal,
        owner: 'id\ttext\tsaid\ton\no-1\tAsk me first\t2026-03-10T11:43:00Z\t-\n',
        lock: false,
      },
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
      next: {
        exitCode: 0,
        stdout:
          'o-2  owner note. It tops the brief until you run: www --session tide-alerts ack o-2. Brief: 9 lines.\n',
        stderr: '',
      },
      ack: {
        exitCode: 0,
        stdout: 'o-1  cleared. Kept in the journal. Brief: 8 lines.\n',
        stderr: '',
      },
      afterAck: {
        journal: row.finalJournal,
        owner: 'id\ttext\tsaid\ton\no-2\tNext note\t2026-03-10T11:43:02Z\t-\n',
        lock: false,
      },
    });
  },
);
