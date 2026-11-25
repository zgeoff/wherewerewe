import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { estimateTokens } from '../brief/estimate-tokens.ts';
import { nothingWrittenComment } from '../refusals/format-refusal.ts';
import { runCLI } from '../run-cli.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { readBriefFigure } from '../test-utils/read-brief-figure.ts';
import { readChangedPaths } from '../test-utils/read-changed-paths.ts';
import { readSavedBrief } from '../test-utils/read-saved-brief.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';

function setupTest() {
  const root = createTempDir('run-owner-write').path;
  const stateRoot = join(root, 'wherewerewe');
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  const run = (argv: readonly string[], isTerminal: boolean) =>
    runCLI({
      argv,
      env: { HOME: root, XDG_STATE_HOME: root },
      cwd: '/work',
      terminal: { stdin: isTerminal, stdout: isTerminal },
      now: () => {
        clock.nowMs += 1000;

        return clock.nowMs - 1000;
      },
    });

  const fixedMs = Date.parse('2026-03-10T11:43:00Z');

  const runFrozen = (argv: readonly string[], isTerminal: boolean) =>
    runCLI({
      argv: ['--session', 'tide-alerts', ...argv],
      env: { HOME: root, XDG_STATE_HOME: root },
      cwd: '/work',
      terminal: { stdin: isTerminal, stdout: isTerminal },
      now: () => fixedMs,
    });

  return {
    runFrozenAsOwner: (argv: readonly string[]) => runFrozen(argv, true),
    readSaved: () =>
      readSavedBrief(join(stateRoot, 'tide-alerts'), {
        nowMs: fixedMs,
        sessionFlag: 'tide-alerts',
        host: null,
      }),
    folder: join(stateRoot, 'tide-alerts'),
    runAsOwner: (argv: readonly string[]) => run(['--session', 'tide-alerts', ...argv], true),
    runAsAgent: (argv: readonly string[]) => run(['--session', 'tide-alerts', ...argv], false),
    init: () => run(['init', 'tide-alerts', '--goal', 'Ship the glaze timer'], false),
    readTree: () => readTreeHashes(stateRoot),
    readSessionFile: (name: string) => readFileSync(join(stateRoot, 'tide-alerts', name), 'utf8'),
  };
}

test('it writes a note to owner.tsv and the journal and nothing else', async () => {
  const ctx = setupTest();

  await ctx.init();

  const before = await ctx.readTree();
  const result = await ctx.runAsOwner(['say', 'Ask me before you change the kiln port']);
  const after = await ctx.readTree();

  expect({
    result,
    changed: readChangedPaths(before, after),
    owner: ctx.readSessionFile('owner.tsv'),
    lastJournalRow: ctx.readSessionFile('journal.tsv').trimEnd().split('\n').at(-1),
  }).toStrictEqual({
    result: {
      exitCode: 0,
      stdout:
        'o-1  owner note. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 168 of 20000 tokens.\n',
      stderr: '',
    },
    changed: ['tide-alerts/journal.tsv', 'tide-alerts/owner.tsv'],
    owner:
      'id\ttext\tsaid\ton\no-1\tAsk me before you change the kiln port\t2026-03-10T11:43:01Z\t-\n',
    lastJournalRow:
      '2026-03-10T11:43:01Z\tsay\to-1\towner\tAsk me before you change the kiln port\t-\t-',
  });
});

test('it writes a note on an item with its id in the extra', async () => {
  const ctx = setupTest();

  await ctx.init();
  await ctx.runAsAgent(['task', 't-timer', 'Write the glaze timer']);

  const result = await ctx.runAsOwner(['say', 'Use the recorded readings', '--on', 't-timer']);

  expect({
    result,
    owner: ctx.readSessionFile('owner.tsv'),
    lastJournalRow: ctx.readSessionFile('journal.tsv').trimEnd().split('\n').at(-1),
  }).toStrictEqual({
    result: {
      exitCode: 0,
      stdout:
        'o-1  owner note on t-timer. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 192 of 20000 tokens.\n',
      stderr: '',
    },
    owner: 'id\ttext\tsaid\ton\no-1\tUse the recorded readings\t2026-03-10T11:43:02Z\tt-timer\n',
    lastJournalRow:
      '2026-03-10T11:43:02Z\tsay\to-1\towner\tUse the recorded readings\t-\ton=t-timer',
  });
});

test('it removes the note on ack and appends the ack row to the journal', async () => {
  const ctx = setupTest();

  await ctx.init();
  await ctx.runAsOwner(['say', 'Ask me first']);

  const before = await ctx.readTree();
  const result = await ctx.runAsOwner(['ack', 'o-1']);
  const after = await ctx.readTree();

  expect({
    result,
    changed: readChangedPaths(before, after),
    owner: ctx.readSessionFile('owner.tsv'),
    lastJournalRow: ctx.readSessionFile('journal.tsv').trimEnd().split('\n').at(-1),
  }).toStrictEqual({
    result: {
      exitCode: 0,
      stdout: 'o-1  cleared. Kept in the journal. Brief: 132 of 20000 tokens.\n',
      stderr: '',
    },
    changed: ['tide-alerts/journal.tsv', 'tide-alerts/owner.tsv'],
    owner: 'id\ttext\tsaid\ton\n',
    lastJournalRow: '2026-03-10T11:43:02Z\tack\to-1\towner\tAsk me first\t-\t-',
  });
});

test.each([
  {
    title: 'an empty note',
    argv: ['say', ''],
    stderr: `www: refused: the owner note is empty.\nRun: www --session tide-alerts say "<owner note>"${nothingWrittenComment}\n`,
  },
  {
    title: 'a note on an unknown item',
    argv: ['say', 'Hello', '--on', 't-none'],
    stderr: `www: refused: no open item t-none. Open items: none.\nRun: www --session tide-alerts say Hello${nothingWrittenComment}\n`,
  },
  {
    title: 'an ack of an unknown note',
    argv: ['ack', 'o-7'],
    stderr: `www: refused: no owner note o-7 shows. Owner notes: none.\nRun: www --session tide-alerts${nothingWrittenComment}\n`,
  },
])('it changes no file when it refuses $title', async (row) => {
  const ctx = setupTest();

  await ctx.init();

  const before = await ctx.readTree();
  const result = await ctx.runAsOwner(row.argv);
  const after = await ctx.readTree();

  expect({ result, tree: after }).toStrictEqual({
    result: { exitCode: 3, stdout: '', stderr: row.stderr },
    tree: before,
  });
});

test('it refuses a say while another process holds the store lock', async () => {
  const ctx = setupTest();

  await ctx.init();

  const state = { release: () => {} };

  const released = new Promise<void>((resolve) => {
    state.release = resolve;
  });

  const holding = withStoreLock(ctx.folder, () => released);

  await waitFor(() => ctx.readSessionFile('lock').length > 0);

  const result = await ctx.runAsOwner(['say', 'Ask me first']);

  state.release();

  await holding;

  expect(result).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr: `www: refused: another write holds the lock on tide-alerts (pid ${String(process.pid)}). Try again.\nRun: www --session tide-alerts say "Ask me first"${nothingWrittenComment}\n`,
  });
});

test('it shows each note first after the goal, and refuses a third until one is cleared', async () => {
  const ctx = setupTest();

  await ctx.init();
  await ctx.runAsAgent(['task', 't-a', 'Write it']);
  await ctx.runAsOwner(['say', 'Ask me first']);

  const afterOne = await ctx.runAsOwner([]);

  await ctx.runAsOwner(['say', 'Use readings', '--on', 't-a']);

  const afterTwo = await ctx.runAsOwner([]);
  const third = await ctx.runAsOwner(['say', 'Ship it Friday']);

  await ctx.runAsOwner(['ack', 'o-1']);

  const afterAck = await ctx.runAsOwner([]);

  await ctx.runAsOwner(['ack', 'o-2']);

  const afterBoth = await ctx.runAsOwner([]);

  expect({ afterOne, afterTwo, third, afterAck, afterBoth }).toStrictEqual({
    afterOne: {
      exitCode: 0,
      stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
OWNER SAYS (1) · act on it; only the owner clears it
  o-1  Ask me first  [0m]
NOW  none. Run: www now <id> "<next step>"
OPEN (1, max 30)
  t-a         Write it  [no check · 0m]
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr: '',
    },
    afterTwo: {
      exitCode: 0,
      stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
OWNER SAYS (2) · act on it; only the owner clears it
  o-1  Ask me first  [0m]
  o-2  Use readings  [on t-a · 0m]
NOW  none. Run: www now <id> "<next step>"
OPEN (1, max 30)
  t-a         Write it  [no check · 0m]
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr: '',
    },
    third: {
      exitCode: 3,
      stdout: '',
      stderr: `www: refused: 2 owner notes already show. Clear one that is done.\nRun: www --session tide-alerts ack o-1${nothingWrittenComment}\n`,
    },
    afterAck: {
      exitCode: 0,
      stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
OWNER SAYS (1) · act on it; only the owner clears it
  o-2  Use readings  [on t-a · 0m]
NOW  none. Run: www now <id> "<next step>"
OPEN (1, max 30)
  t-a         Write it  [no check · 0m]
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr: '',
    },
    afterBoth: {
      exitCode: 0,
      stdout: `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks
GOAL  Ship the glaze timer
GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"
NOW  none. Run: www now <id> "<next step>"
OPEN (1, max 30)
  t-a         Write it  [no check · 0m]
Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help
`,
      stderr: '',
    },
  });
});

test('it counts the two note lines and the section line in an agent write reply', async () => {
  const ctx = setupTest();

  await ctx.init();
  await ctx.runAsOwner(['say', 'Ask me first']);
  await ctx.runAsOwner(['say', 'Use readings']);

  const result = await ctx.runAsAgent(['task', 't-a', 'Write it']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: 't-a  task, open, no check. Brief: 187 of 20000 tokens.\n',
    stderr: '',
  });
});

test.each([
  {
    title: 'an imported say of o-4',
    imported: 'o-4',
    result: {
      exitCode: 0,
      stdout:
        'o-5  owner note. It shows in every brief until you run: www --session tide-alerts ack o-5. Brief: 159 of 20000 tokens.\n',
      stderr: '',
    },
    owner: 'id\ttext\tsaid\ton\no-5\tAsk me first\t2026-03-10T11:43:01Z\t-\n',
  },
  {
    title: 'an imported say of the highest safe number',
    imported: 'o-9007199254740991',
    result: {
      exitCode: 3,
      stdout: '',
      stderr: `www: refused: owner note numbers are used up after o-9007199254740991.\nRun: www --session tide-alerts log --op say${nothingWrittenComment}\n`,
    },
    owner: 'id\ttext\tsaid\ton\n',
  },
])('it numbers the first note from the journal after $title', async (row) => {
  const ctx = setupTest();

  await ctx.init();

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-01T08:00:00Z',
    op: 'say',
    id: row.imported,
    by: 'import',
  });

  const first = await ctx.runAsOwner(['say', 'Ask me first']);

  expect({ first, owner: ctx.readSessionFile('owner.tsv') }).toStrictEqual({
    first: row.result,
    owner: row.owner,
  });
});

test('it never reuses the number of an acknowledged note', async () => {
  const ctx = setupTest();

  await ctx.init();
  await ctx.runAsOwner(['say', 'Ask me first']);
  await ctx.runAsOwner(['say', 'Use the recorded readings']);
  await ctx.runAsOwner(['ack', 'o-2']);
  await ctx.runAsOwner(['ack', 'o-1']);

  const next = await ctx.runAsOwner(['say', 'Ship the timer first']);

  expect(next).toStrictEqual({
    exitCode: 0,
    stdout:
      'o-3  owner note. It shows in every brief until you run: www --session tide-alerts ack o-3. Brief: 162 of 20000 tokens.\n',
    stderr: '',
  });
});

test.each([
  { title: 'say', setup: [], argv: ['say', 'Ask me first'] },
  {
    title: 'say on an item',
    setup: [['task', 't-a', 'Write it']],
    argv: ['say', 'Go', '--on', 't-a'],
  },
  { title: 'ack', setup: [['say', 'Ask me first']], argv: ['ack', 'o-1'] },
] as const)(
  'it reports in each write reply the estimate of the brief rendered from the saved store, for the owner terminal after $title',
  async (row) => {
    const ctx = setupTest();

    await ctx.init();

    for (const argv of row.setup) {
      await ctx.runFrozenAsOwner(argv);
    }

    const reply = await ctx.runFrozenAsOwner(row.argv);
    const saved = await ctx.readSaved();

    expect({ exitCode: reply.exitCode, figure: readBriefFigure(reply.stdout) }).toStrictEqual({
      exitCode: 0,
      figure: { tokens: estimateTokens(saved), limit: 20_000 },
    });
  },
);
