import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from './run-cli.ts';
import { withBindingLock } from './sessions/with-binding-lock.ts';
import { formatNotesFile } from './store/format-notes-file.ts';
import { parseItemsFile } from './store/parse-items-file.ts';
import { parseJournalFile } from './store/parse-journal-file.ts';
import { readJournalRows } from './store/read-journal-rows.ts';
import { readStore } from './store/read-store.ts';
import { withStoreLock } from './store/with-store-lock.ts';
import { readChangedPaths } from './test-utils/read-changed-paths.ts';
import { readShellWords } from './test-utils/read-shell-words.ts';
import { readTreeHashes } from './test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from './test-utils/seed-format-1-store.ts';
import { seedItem } from './test-utils/seed-item.ts';
import { seedJournalRow } from './test-utils/seed-journal-row.ts';
import { seedStoreFile } from './test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('run-cli').path;
  const stateRoot = join(root, 'wherewerewe');
  const agentEnv = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  return {
    stateRoot,
    agentEnv,
    run: (
      argv: readonly string[],
      env: Record<string, string | undefined> = agentEnv,
      terminal: { stdin: boolean; stdout: boolean } | null = null,
    ) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: terminal ?? { stdin: false, stdout: false },
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    readTree: () => readTreeHashes(stateRoot),
    advance: (durationMs: number) => {
      clock.nowMs += durationMs;
    },
  };
}

test.each([[['help']], [['--help']], [['-h']]])(
  'it prints the whole help text for %p',
  async (argv) => {
    const ctx = setupTest();

    const designText = readFileSync(
      join(import.meta.dir, '..', '..', '..', 'docs', 'design', 'wherewerewe', 'commands.md'),
      'utf8',
    );

    const result = await ctx.run(argv, {});

    const helpBlock = /```text\n(?<help>www \(wherewerewe\).*?)```/su.exec(designText)?.groups?.[
      'help'
    ];

    const actual: unknown = result;

    expect(actual).toStrictEqual({ exitCode: 0, stdout: helpBlock, stderr: '' });
  },
);

test.each([
  [['taks'], 'www: unknown command "taks".\nRun: www help\n'],
  [['doctor', 'x'], 'www: "doctor" comes in a later version of www.\nRun: www help\n'],
  [['task', 't-a'], 'www: task takes <id> "<claim>".\nRun: www help\n'],
  [
    ['--session', 'sample', 'task', 'x', '--bogus'],
    'www: unknown flag "--bogus".\nRun: www --session sample help\n',
  ],
])('it refuses %p with exit 2', async (argv, stderr) => {
  const ctx = setupTest();

  const result = await ctx.run(argv);

  expect(result).toStrictEqual({ exitCode: 2, stdout: '', stderr });
});

test('it refuses with exit 4 when neither XDG_STATE_HOME nor HOME names a store folder', async () => {
  const ctx = setupTest();

  const result = await ctx.run([], {});

  expect(result).toStrictEqual({
    exitCode: 4,
    stdout: '',
    stderr: 'www: no store folder: set XDG_STATE_HOME or HOME.\nRun: www help\n',
  });
});

test('it lists no sessions, and never refuses, when neither XDG_STATE_HOME nor HOME names a store folder', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['sessions'], {});

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: 'No sessions on this machine yet. Run: www init <name> --goal "<what done means>"\n',
    stderr: '',
  });
});

test('it prints the brief from the rows that parse when one item row is broken, and says what it left out', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  seedStoreFile(
    join(ctx.stateRoot, 'tide-alerts'),
    'items.tsv',
    `${readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8')}t-b\ttask\n`,
  );

  const result = await ctx.run([]);

  expect({
    exitCode: result.exitCode,
    hasTask: result.stdout.includes('  t-a         Write it  [no check · 0m]\n'),
    stderr: result.stderr,
  }).toStrictEqual({
    exitCode: 0,
    hasTask: true,
    stderr:
      "www: tide-alerts's items.tsv line 3 does not parse: expected 9 tab-separated columns, found 2. The brief leaves out what it could not read. Fix the file by hand.\n",
  });
});

test('it labels a store of a newer format in the session list', async () => {
  const ctx = setupTest();

  seedStoreFile(join(ctx.stateRoot, 'sample'), 'session', 'format=3\n');

  const result = await ctx.run(['sessions']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: '  sample  format 3: this www reads format 2\n',
    stderr: '',
  });
});

test('it labels a format 1 store in the session list with the command that upgrades it', async () => {
  const ctx = setupTest();

  seedFormat1Store(ctx.stateRoot, 'sample');

  const result = await ctx.run(['sessions']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: '  sample  format 1: run www import sample\n',
    stderr: '',
  });
});

test.each([
  { command: 'brief', argv: ['--session', 'sample'], isOwner: false },
  { command: 'show', argv: ['show', 't-valves', '--session', 'sample'], isOwner: false },
  { command: 'log', argv: ['log', '--session', 'sample'], isOwner: false },
  { command: 'goal', argv: ['goal', 'Ship more', '--session', 'sample'], isOwner: false },
  {
    command: 'grant',
    argv: ['grant', '--quote', 'Go.', '--where', 'chat', '--reading', 'r', '--session', 'sample'],
    isOwner: false,
  },
  { command: 'now', argv: ['now', 't-valves', 'go', '--session', 'sample'], isOwner: false },
  { command: 'task', argv: ['task', 't-x', 'x', '--session', 'sample'], isOwner: false },
  {
    command: 'wait',
    argv: ['wait', 'w-x', 'x', '--who', 'a', '--session', 'sample'],
    isOwner: false,
  },
  {
    command: 'ok',
    argv: [
      'ok',
      'ok-x',
      '--quote',
      'q',
      '--who',
      'o',
      '--where',
      'chat',
      '--scope',
      's',
      '--session',
      'sample',
    ],
    isOwner: false,
  },
  { command: 'rule', argv: ['rule', 'r-x', 'x', '--session', 'sample'], isOwner: false },
  { command: 'where', argv: ['where', 'wh-x', 'x', '--session', 'sample'], isOwner: false },
  { command: 'set', argv: ['set', 't-valves', 'x', '--session', 'sample'], isOwner: false },
  { command: 'decide', argv: ['decide', 'x', '--why', 'y', '--session', 'sample'], isOwner: false },
  {
    command: 'done',
    argv: ['done', 't-valves', '--evidence', 'e', '--session', 'sample'],
    isOwner: false,
  },
  {
    command: 'drop',
    argv: ['drop', 't-valves', '--why', 'y', '--session', 'sample'],
    isOwner: false,
  },
  { command: 'use', argv: ['use', 'ok-wipe', '--for', 'f', '--session', 'sample'], isOwner: false },
  { command: 'attach', argv: ['attach', 'sample'], isOwner: false },
  { command: 'detach', argv: ['detach'], isOwner: false },
  { command: 'init', argv: ['init', 'sample', '--goal', 'Ship it'], isOwner: false },
  { command: 'say', argv: ['say', 'x', '--session', 'sample'], isOwner: true },
  { command: 'ack', argv: ['ack', 'o-1', '--session', 'sample'], isOwner: true },
])('it exits 5 on a format 1 store for $command', async (row) => {
  const ctx = setupTest();

  seedFormat1Store(ctx.stateRoot, 'sample');
  seedStoreFile(join(ctx.stateRoot, '.bindings'), 'claude-a1b2-test', 'name=sample\n');

  const before = await ctx.readTree();

  const agentEnv = ctx.agentEnv;
  const ownerEnv = { HOME: agentEnv.HOME, XDG_STATE_HOME: agentEnv.XDG_STATE_HOME };
  const env = row.isOwner ? ownerEnv : agentEnv;
  const terminal = row.isOwner ? { stdin: true, stdout: true } : null;

  const result = await ctx.run(row.argv, env, terminal);
  const after = await ctx.readTree();

  const stderrLines = result.stderr.split('\n');

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout,
    isFormat1Refusal: stderrLines.some((line) => line.includes('sample is format 1')),
    unchanged: after,
  }).toStrictEqual({ exitCode: 5, stdout: '', isFormat1Refusal: true, unchanged: before });
});

test.each(['sessions', 'help'])(
  'it does not exit 5 on a format 1 store for %s',
  async (command) => {
    const ctx = setupTest();

    seedFormat1Store(ctx.stateRoot, 'sample');

    const result = await ctx.run([command]);

    expect(result.exitCode).toBe(0);
  },
);

test('it never journals a detach on a session the binding no longer names', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'alpha-notes');
  const released = Promise.withResolvers<undefined>();
  const otherEnv = { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: '9c21-beta' };

  await ctx.run(['init', 'alpha-notes', '--goal', 'Alpha goal']);
  await ctx.run(['init', 'beta-notes', '--goal', 'Beta goal'], otherEnv);

  const holder = withStoreLock(folder, () => released.promise);

  await waitFor(() => readFileSync(join(folder, 'lock')));

  const detached = ctx.run(['detach']);

  await ctx.run(['attach', 'beta-notes']);

  released.resolve(undefined);

  await holder;
  await detached;

  const ops = (name: string) =>
    parseJournalFile(readFileSync(join(ctx.stateRoot, name, 'journal.tsv'), 'utf8')).map(
      (row) => `${row.op}:${row.text ?? ''}`,
    );

  expect({
    alpha: ops('alpha-notes'),
    beta: ops('beta-notes'),
    bindingKept: existsSync(join(ctx.stateRoot, '.bindings', 'claude-a1b2-test')),
  }).toStrictEqual({
    alpha: ['init:Alpha goal', 'bind:init'],
    beta: ['init:Beta goal', 'bind:init', 'bind:attach', 'bind:detach'],
    bindingKept: false,
  });
});

test('it refuses init while the binding lock is held, and creates no store and no binding', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();
  const holder = withBindingLock(ctx.stateRoot, () => released.promise);

  await waitFor(() => readFileSync(join(ctx.stateRoot, '.bindings', 'lock')));

  const before = await ctx.readTree();
  const result = await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  const after = await ctx.readTree();

  released.resolve(undefined);

  await holder;

  expect({ result, unchanged: after }).toStrictEqual({
    result: {
      exitCode: 3,
      stdout: '',
      stderr: `www: refused: another write holds the lock on tide-alerts (pid ${String(process.pid)}). Try again.\nRun: www init tide-alerts --goal "Ship it"\n`,
    },
    unchanged: before,
  });
});

test('it leaves a binding that agrees with the journal when an attach and a detach start together', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();
  const bindingPath = join(ctx.stateRoot, '.bindings', 'claude-a1b2-test');

  await ctx.run(['init', 'alpha-notes', '--goal', 'Alpha goal']);

  await ctx.run(['init', 'beta-notes', '--goal', 'Beta goal'], {
    ...ctx.agentEnv,
    CLAUDE_CODE_SESSION_ID: '9c21-beta',
  });

  const holder = withBindingLock(ctx.stateRoot, () => released.promise);

  await waitFor(() => readFileSync(join(ctx.stateRoot, '.bindings', 'lock')));

  const both = Promise.all([ctx.run(['detach']), ctx.run(['attach', 'beta-notes'])]);

  released.resolve(undefined);

  await holder;
  await both;

  const bindRows = parseJournalFile(
    readFileSync(join(ctx.stateRoot, 'beta-notes', 'journal.tsv'), 'utf8'),
  ).filter((row) => row.op === 'bind' && row.extra?.includes('a1b2-test') === true);

  const isBound = existsSync(bindingPath);
  const expectedBind = isBound ? 'attach' : 'detach';

  expect(bindRows.at(-1)?.text).toBe(expectedBind);
});

test.each([
  [
    'init',
    [],
    ['init', 'tide-alerts', '--goal', 'Ship it'],
    {
      env: {},
      stdout:
        'Started session tide-alerts in <STATE>/tide-alerts. Bound to this Claude Code session.\n',
      changed: [
        '.bindings/claude-a1b2-test',
        'tide-alerts/items.tsv',
        'tide-alerts/journal.tsv',
        'tide-alerts/owner.tsv',
        'tide-alerts/prs.tsv',
        'tide-alerts/session',
      ],
    },
  ],
  [
    'attach',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['attach', 'tide-alerts'],
    {
      env: { CLAUDE_CODE_SESSION_ID: 'c3d4-other' },
      stdout: 'Bound this Claude Code session to tide-alerts.\n',
      changed: ['.bindings/claude-c3d4-other', 'tide-alerts/journal.tsv'],
    },
  ],
  [
    'detach',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['detach'],
    {
      env: {},
      stdout: 'Unbound this Claude Code session from tide-alerts.\n',
      changed: ['.bindings/claude-a1b2-test', 'tide-alerts/journal.tsv'],
    },
  ],
  [
    'goal',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['goal', 'Ship the parser'],
    {
      env: {},
      stdout: 'goal set. Brief: 5 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'now',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['now', 't-a', 'go'],
    {
      env: {},
      stdout: 'now: t-a. Brief: 8 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'task',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['task', 't-a', 'Write it'],
    {
      env: {},
      stdout: 't-a  task, open, no check. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'wait',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['wait', 'w-a', 'Answer', '--who', 'owner'],
    {
      env: {},
      stdout: 'w-a  wait, open, no check. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'rule',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['rule', 'r-a', 'Run from api/'],
    {
      env: {},
      stdout: 'r-a  rule, open. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'where',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['where', 'wt-a', 'A worktree', '--path', '/srv/app'],
    {
      env: {},
      stdout: 'wt-a  where, open, no check run. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'set',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['set', 't-a', 'Written another way'],
    {
      env: {},
      stdout: 't-a  task, open, no check. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'done',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
    {
      env: {},
      stdout: 't-a  done. Off the brief, kept in the journal. Brief: 5 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'drop',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['drop', 't-a', '--why', 'stopped'],
    {
      env: {},
      stdout: 't-a  dropped. Off the brief, kept in the journal. Brief: 5 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'ok',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    [
      'ok',
      'ok-merge',
      '--quote',
      'merge the alert PRs yourself',
      '--who',
      'owner',
      '--where',
      'terminal',
      '--scope',
      'bosun-api',
      '--once',
    ],
    {
      env: {},
      stdout: 'ok-merge  ok, open, no check. Brief: 7 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'use',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'ok',
        'ok-merge',
        '--quote',
        'merge the alert PRs yourself',
        '--who',
        'owner',
        '--where',
        'terminal',
        '--scope',
        'bosun-api',
        '--once',
      ],
    ],
    ['use', 'ok-merge', '--for', 'merged the alert PR'],
    {
      env: {},
      stdout: 'ok-merge  used. Off the brief, kept in the journal. Brief: 5 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'task --note',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['task', 't-a', 'Write it', '--note', 'Stop the simulator first', '--owed'],
    {
      env: {},
      stdout: 't-a  task, open, no check, note 24 of 400, owed. Brief: 7 lines.\n',
      changed: [
        'tide-alerts/items.tsv',
        'tide-alerts/journal.tsv',
        'tide-alerts/notes.tsv',
        'tide-alerts/session',
      ],
    },
  ],
  [
    'set --note',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['set', 't-a', '--note', 'Stop the simulator first'],
    {
      env: {},
      stdout: 't-a  note, 24 of 400. Brief: 7 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/notes.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'now --note',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['now', 't-a', 'go', '--note', 'Stop the simulator first'],
    {
      env: {},
      stdout: 'now: t-a, with its note (0m). Brief: 9 lines.\n    Stop the simulator first\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/notes.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'done of an item with a note',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it', '--note', 'Stop the simulator first'],
    ],
    ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
    {
      env: {},
      stdout:
        't-a  done. Off the brief, kept in the journal with its note (0m). Brief: 5 lines.\n    Stop the simulator first\n',
      changed: [
        'tide-alerts/items.tsv',
        'tide-alerts/journal.tsv',
        'tide-alerts/notes.tsv',
        'tide-alerts/session',
      ],
    },
  ],
  [
    'grant --quote',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['grant', '--quote', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'],
    {
      env: {},
      stdout: 'grant: 18 of 700 characters, reading 13 of 200. Brief: 7 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'grant --reading',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['grant', '--quote', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'],
    ],
    ['grant', '--reading', 'covers merges and nothing else'],
    {
      env: {},
      stdout: 'grant reading: 30 of 200. Brief: 7 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'decide',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--on', 't-a'],
    {
      env: {},
      stdout: 'd-1  decision on t-a. Read it with: www show t-a. Brief: 7 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'show',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    ['show', 't-a'],
    {
      env: {},
      stdout:
        't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  journal: day 1 task\n',
      changed: [],
    },
  ],
  [
    'log',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['log', '--op', 'init'],
    {
      env: {},
      stdout: 'day 1  11:43  init      tide-alerts agent  Ship it\n',
      changed: [],
    },
  ],
  [
    'sessions',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['sessions'],
    { env: {}, stdout: '  tide-alerts  day 1  last write 0m ago  Ship it\n', changed: [] },
  ],
  [
    'the brief',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    [],
    {
      env: {},
      stdout: [
        'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks',
        'GOAL  Ship it',
        `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
        'NOW  none. Run: www now <id> "<next step>"',
        'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
        '',
      ].join('\n'),
      changed: [],
    },
  ],
  [
    'help',
    [],
    ['help'],
    { env: {}, stdout: expect.stringContaining('www (wherewerewe):'), changed: [] },
  ],
])('it changes only the files that %s names', async (_command, setup, argv, expected) => {
  const ctx = setupTest();

  for (const setupArgv of setup) {
    await ctx.run(setupArgv);
  }

  const before = await ctx.readTree();
  const result = await ctx.run(argv, { ...ctx.agentEnv, ...expected.env });
  const after = await ctx.readTree();

  const stdout =
    typeof expected.stdout === 'string'
      ? expected.stdout.replace('<STATE>', ctx.stateRoot)
      : expected.stdout;

  const actual: unknown = { ...result, changed: readChangedPaths(before, after) };

  expect(actual).toStrictEqual({
    exitCode: 0,
    stdout,
    stderr: '',
    changed: expected.changed,
  });
});

test('it keeps two sessions apart: each agent reads and writes only its own store', async () => {
  const ctx = setupTest();
  const alphaEnv = { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: '0f3a-alpha' };
  const betaEnv = { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: '9c21-beta' };

  await ctx.run(['init', 'alpha-notes', '--goal', 'Alpha goal'], alphaEnv);
  await ctx.run(['init', 'beta-notes', '--goal', 'Beta goal'], betaEnv);
  await ctx.run(['task', 't-one', 'Alpha only'], alphaEnv);

  const before = await ctx.readTree();

  await ctx.run(['task', 't-two', 'Beta only'], betaEnv);

  const after = await ctx.readTree();
  const alphaBrief = await ctx.run([], alphaEnv);
  const betaBrief = await ctx.run([], betaEnv);

  expect({
    alphaFilesChanged: Object.keys(after).filter(
      (path) => path.startsWith('alpha-notes/') && before[path] !== after[path],
    ),
    alphaHasOwn: alphaBrief.stdout.includes('Alpha only'),
    alphaHasOther: alphaBrief.stdout.includes('Beta only'),
    betaHasOwn: betaBrief.stdout.includes('Beta only'),
    betaHasOther: betaBrief.stdout.includes('Alpha only'),
  }).toStrictEqual({
    alphaFilesChanged: [],
    alphaHasOwn: true,
    alphaHasOther: false,
    betaHasOwn: true,
    betaHasOther: false,
  });
});

test('it lists each session with its day, its last write and its goal cut to 60 characters, and flags a hand-kept store', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'alpha', '--goal', 'g'.repeat(61)]);

  await ctx.run(['init', 'beta-notes', '--goal', 'Short goal'], {
    ...ctx.agentEnv,
    CLAUDE_CODE_SESSION_ID: 'second-agent',
  });

  seedStoreFile(
    join(ctx.stateRoot, 'old-kept'),
    'session',
    'name=old\ngoal=x\nstarted=2026-03-02T08:00:00Z\n',
  );

  const result = await ctx.run(['sessions']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: [
      `  alpha       day 1  last write 0m ago  ${'g'.repeat(60)}…`,
      '  beta-notes  day 1  last write 0m ago  Short goal',
      '  old-kept    hand-kept: run www import old-kept',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('it says how to start a session when there is none', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['sessions']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: 'No sessions on this machine yet. Run: www init <name> --goal "<what done means>"\n',
    stderr: '',
  });
});

test('it names the session on each command when the shell has no agent session id', async () => {
  const ctx = setupTest();
  const shellEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: join(ctx.stateRoot, '..') };

  const started = await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], shellEnv);
  const written = await ctx.run(['--session', 'tide-alerts', 'task', 't-a', 'Write it'], shellEnv);

  expect([started.stdout, written.stdout]).toStrictEqual([
    `Started session tide-alerts in ${join(ctx.stateRoot, 'tide-alerts')}. Name it on each command: www --session tide-alerts\n`,
    't-a  task, open, no check. Brief: 7 lines.\n',
  ]);
});

test('it finds the session by WHEREWEREWE_SESSION', async () => {
  const ctx = setupTest();

  const shellEnv = {
    HOME: ctx.agentEnv.HOME,
    XDG_STATE_HOME: join(ctx.stateRoot, '..'),
    WHEREWEREWE_SESSION: 'tide-alerts',
  };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['task', 't-a', 'Write it'], shellEnv);

  expect(result.stdout).toBe('t-a  task, open, no check. Brief: 7 lines.\n');
});

test('it replaces an open item of the same kind in place, keeping its row and replacing its check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'First claim', '--pid', '5']);
  await ctx.run(['task', 't-b', 'Second claim']);
  await ctx.run(['task', 't-a', 'First claim, written again']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n').slice(4, 8)).toStrictEqual([
    'OPEN (2 of 6)',
    '  t-a         First claim, written again  [no check · 0m]',
    '  t-b         Second claim  [no check · 0m]',
    'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
  ]);
});

test('it keeps the kind, row and extra of an item when set replaces its claim, and keeps its check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['wait', 'w-a', 'Answer', '--who', 'vendor', '--pid', '5']);
  await ctx.run(['set', 'w-a', 'Answer, in writing']);

  const brief = await ctx.run([]);

  expect(brief.stdout).toInclude('  w-a         Answer, in writing  [vendor · not checked yet]\n');
});

test('it clears the item in focus when done closes it', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);
  await ctx.run(['now', 't-a', 'go']);
  await ctx.run(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n')[3]).toBe('NOW  none. Run: www now <id> "<next step>"');
});

test('it keeps the item in focus when a different item closes', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);
  await ctx.run(['task', 't-b', 'Write more']);
  await ctx.run(['now', 't-a', 'go']);
  await ctx.run(['drop', 't-b', '--why', 'stopped']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n').slice(3, 5)).toStrictEqual([
    'NOW  t-a · set 0m ago',
    '  next: go',
  ]);
});

test('it records each write in the journal, with the check but no free text in extra', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['wait', 'w-a', 'Answer', '--who', 'vendor', '--pid', '5']);
  await ctx.run(['done', 'w-a', '--evidence', 'the answer came']);

  const journal = readFileSync(join(ctx.stateRoot, 'tide-alerts', 'journal.tsv'), 'utf8');

  expect(journal).toBe(
    [
      'ts\top\tid\tby\ttext\twhy\textra',
      '2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip it\t-\t-',
      '2026-03-10T11:43:00Z\tbind\ttide-alerts\tagent\tinit\t-\tharness=claude;agent=a1b2-test',
      '2026-03-10T11:43:01Z\twait\tw-a\tagent\tAnswer\t-\tcheck=pid:5',
      '2026-03-10T11:43:02Z\tdone\tw-a\tagent\tAnswer\tthe answer came\t-',
      '',
    ].join('\n'),
  );
});

test('it closes an item with done after an earlier done stopped between its journal row and the rewrite', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  await seedJournalRow(folder, { ts: '2026-03-10T11:43:02Z', op: 'done', id: 't-a' });

  const result = await ctx.run(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  const itemsText = readFileSync(join(folder, 'items.tsv'), 'utf8');

  expect({ result, items: parseItemsFile(itemsText, '2') }).toStrictEqual({
    result: {
      exitCode: 0,
      stdout: 't-a  done. Off the brief, kept in the journal. Brief: 5 lines.\n',
      stderr: '',
    },
    items: { kind: 'items', items: [] },
  });
});

test('it refuses a new item on an id whose done reached the journal before the write stopped', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  await seedJournalRow(folder, { ts: '2026-03-10T11:43:02Z', op: 'done', id: 't-a' });

  await ctx.run(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  const result = await ctx.run(['task', 't-a', 'Write it again']);

  expect(result).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr:
      'www: refused: t-a closed on day 1. Pick a new id.\nRun: www task <new id> "Write it again"\n',
  });
});

test('it prints show and log from a session written across three days', async () => {
  const ctx = setupTest();
  const dayMs = 86_400_000;

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries a 503', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run(['task', 't-old', 'Write the feed client']);
  await ctx.run(['wait', 'w-apns', 'upload the staging push key', '--who', 'owner']);

  await ctx.run([
    'ok',
    'ok-wipe',
    '--quote',
    'wipe the staging tmp dir',
    '--who',
    'owner',
    '--where',
    'terminal',
    '--scope',
    'bosun-api',
    '--once',
  ]);

  ctx.advance(dayMs);

  await ctx.run([
    'decide',
    'Queue the alert in the job, not the request, so a slow feed never blocks a save',
    '--why',
    'The request path has a 2 s budget',
    '--on',
    'pr-api-77',
    '--who',
    'owner',
  ]);

  await ctx.run(['done', 't-old', '--evidence', 'merged as 51aa0e2']);

  ctx.advance(dayMs);

  await ctx.run([
    'decide',
    'Retry a 503 from the tide feed 3 times',
    '--why',
    'The feed returns 503 for about 4 s during its hourly refresh',
    '--on',
    'pr-api-77',
    '--replaces',
    'd-1',
    '--who',
    'owner',
  ]);

  await ctx.run(['decide', 'Poll the feed every minute', '--why', 'Too slow', '--ruled-out']);
  await ctx.run(['use', 'ok-wipe', '--for', 'wiped it']);

  const shows = [];

  for (const id of ['pr-api-77', 'w-apns', 'ok-wipe', 't-old', 'd-1', 'd-3', 'd-9']) {
    const shown = await ctx.run(['show', id]);

    shows.push(shown.stdout);
  }

  const log = await ctx.run(['log', '--op', 'done,decide,ruled-out,use', '--since', 'day-2']);

  expect({ shows, log: log.stdout }).toStrictEqual({
    shows: [
      [
        'pr-api-77  task, open since day 1, by agent · check: pr:bosunhq/bosun-api#77',
        '  claim (2d): Alert job retries a 503',
        '  checked now: not checked yet · at write: not checked yet',
        '  decisions: d-1 Queue the alert in the job, not the requ… (day 2) · d-2 Retry a 503 from the tide feed 3 times (day 3)',
        '  journal: day 1 task',
        '',
      ].join('\n'),
      [
        'w-apns  wait, open since day 1, by agent · waits on owner',
        '  what (2d): upload the staging push key',
        '  journal: day 1 wait',
        '',
      ].join('\n'),
      [
        'ok-wipe  closed: used on day 3, by agent',
        '  claim at close: wipe the staging tmp dir',
        '  used for: wiped it',
        '  journal: day 1 ok · day 3 use',
        '',
      ].join('\n'),
      [
        't-old  closed: done on day 2, by agent',
        '  claim at close: Write the feed client',
        '  evidence: merged as 51aa0e2',
        '  journal: day 1 task · day 2 done',
        '',
      ].join('\n'),
      [
        'd-1  decision on pr-api-77 · day 2 · by owner',
        '  choice: Queue the alert in the job, not the request, so a slow feed never blocks a save',
        '  why: The request path has a 2 s budget',
        '  replaced by: d-2',
        '  journal: day 2 decide',
        '',
      ].join('\n'),
      [
        'd-3  ruled out · day 3 · by agent',
        '  choice: Poll the feed every minute',
        '  why: Too slow',
        '  journal: day 3 ruled-out',
        '',
      ].join('\n'),
      'd-9: no item, decision or journal row has this id. Open items: pr-api-77, w-apns.\n',
    ],
    log: [
      'day 2  11:43  decide    d-1        owner  Queue the alert in the job, not the request, so a slow feed never blocks a save',
      '                                          why: The request path has a 2 s budget',
      'day 2  11:43  done      t-old      agent  Write the feed client',
      '                                          why: merged as 51aa0e2',
      'day 3  11:43  decide    d-2        owner  Retry a 503 from the tide feed 3 times',
      '                                          why: The feed returns 503 for about 4 s during its hourly refresh',
      'day 3  11:43  ruled-out d-3        agent  Poll the feed every minute',
      '                                          why: Too slow',
      'day 3  11:43  use       ok-wipe    agent  wipe the staging tmp dir',
      '                                          why: wiped it',
      '',
    ].join('\n'),
  });
});

test.each([
  [
    ['show', 't-a'],
    't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  journal: day 1 task\n',
  ],
  [['log', '--id', 't-a'], 'day 1  11:43  task      t-a        agent  Write it\n'],
])(
  'it prints %p from the rows that parse when one item row is broken, and says what it left out',
  async (argv, stdout) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Write it']);

    seedStoreFile(
      join(ctx.stateRoot, 'tide-alerts'),
      'items.tsv',
      `${readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8')}t-b\ttask\n`,
    );

    const result = await ctx.run(argv);

    expect(result).toStrictEqual({
      exitCode: 0,
      stdout,
      stderr:
        "www: tide-alerts's items.tsv line 3 does not parse: expected 9 tab-separated columns, found 2. This read leaves out what it could not read. Fix the file by hand.\n",
    });
  },
);

test('it prints an open item with no history, and says so, when the journal cannot be read', async () => {
  const ctx = setupTest();
  const journalPath = join(ctx.stateRoot, 'tide-alerts', 'journal.tsv');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  rmSync(journalPath);
  mkdirSync(journalPath);

  const result = await ctx.run(['show', 't-a']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: 't-a  task, open since day 1, by agent\n  claim (0m): Write it\n',
    stderr:
      "www: tide-alerts's journal.tsv does not parse: EISDIR. This read leaves out what it could not read. Fix the file by hand.\n",
  });
});

test.each([
  { command: 'say', argv: ['--session', 'tide-alerts', 'say', 'Ask me first'] },
  { command: 'ack', argv: ['--session', 'tide-alerts', 'ack', 'o-1'] },
])(
  'it refuses $command with exit 3 and changes nothing in an agent shell, for each signal',
  async (row) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

    const before = await ctx.readTree();

    const ownerEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };

    const results = {
      noStdin: await ctx.run(row.argv, ownerEnv, { stdin: false, stdout: true }),
      noStdout: await ctx.run(row.argv, ownerEnv, { stdin: true, stdout: false }),
      claudeCode: await ctx.run(
        row.argv,
        { ...ownerEnv, CLAUDECODE: '1' },
        { stdin: true, stdout: true },
      ),
      claudeSession: await ctx.run(
        row.argv,
        { ...ownerEnv, CLAUDE_CODE_SESSION_ID: '1' },
        { stdin: true, stdout: true },
      ),
      codexSession: await ctx.run(
        row.argv,
        { ...ownerEnv, CODEX_SESSION_ID: '1' },
        { stdin: true, stdout: true },
      ),
      codexThread: await ctx.run(
        row.argv,
        { ...ownerEnv, CODEX_THREAD_ID: '1' },
        { stdin: true, stdout: true },
      ),
      codexCI: await ctx.run(
        row.argv,
        { ...ownerEnv, CODEX_CI: '1' },
        { stdin: true, stdout: true },
      ),
    };

    const refusal = {
      exitCode: 3 as const,
      stdout: '',
      stderr:
        'www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait, an approval or the grant.\nRun: www --session tide-alerts rule <id> "<what the owner said, as a rule>"\n',
    };

    expect({ results, tree: await ctx.readTree() }).toStrictEqual({
      results: {
        noStdin: refusal,
        noStdout: refusal,
        claudeCode: refusal,
        claudeSession: refusal,
        codexSession: refusal,
        codexThread: refusal,
        codexCI: refusal,
      },
      tree: before,
    });
  },
);

test('it lets say run for an owner with agent variables set to an empty value', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

  const result = await ctx.run(
    ['--session', 'tide-alerts', 'say', 'Ask me first'],
    {
      HOME: ctx.agentEnv.HOME,
      XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME,
      CLAUDECODE: '',
      CLAUDE_CODE_SESSION_ID: '',
      CODEX_SESSION_ID: '',
      CODEX_THREAD_ID: '',
      CODEX_CI: '',
    },
    { stdin: true, stdout: true },
  );

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout:
      'o-1  owner note. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 7 lines.\n',
    stderr: '',
  });
});

test('it names the agent as the writer of the words the format 2 upgrade set', async () => {
  const ctx = setupTest();

  seedFormat1Store(ctx.stateRoot, 'sample');

  await ctx.run([
    'import',
    'sample',
    '--quote',
    'Merge the garden-api pull requests yourself.',
    '--where',
    'chat',
    '--reading',
    'covers garden-api merges',
  ]);

  const result = await ctx.run(['--session', 'sample', 'show', 'grant']);

  expect(result.stdout.split('\n').at(0)).toMatch(
    /^grant {2}from the owner in chat, words set on day \d+ by agent, reading set on day \d+$/u,
  );
});

test("it names the agent as the writer of the words when the agent writes the owner's words again in the same second", async () => {
  const ctx = setupTest();
  const ownerEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };
  const grant = ['--quote', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'];

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

  await ctx.run(['--session', 'tide-alerts', 'grant', ...grant], ownerEnv, {
    stdin: true,
    stdout: true,
  });

  ctx.advance(-1000);

  await ctx.run(['--session', 'tide-alerts', 'grant', ...grant], ctx.agentEnv);

  const result = await ctx.run(['--session', 'tide-alerts', 'show', 'grant'], ctx.agentEnv);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: [
      'grant  from the owner in chat, words set on day 1 by agent, reading set on day 1',
      '  words (0m): "Merge it yourself."',
      '  reading (0m): covers merges',
      '  journal: day 1 grant · day 1 grant',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('it names the agent as the writer of the words after the owner replaces the reading alone in the same second', async () => {
  const ctx = setupTest();
  const ownerEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };
  const grant = ['--quote', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'];

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

  await ctx.run(['--session', 'tide-alerts', 'grant', ...grant], ownerEnv, {
    stdin: true,
    stdout: true,
  });

  ctx.advance(-1000);

  await ctx.run(['--session', 'tide-alerts', 'grant', ...grant], ctx.agentEnv);

  ctx.advance(-1000);

  await ctx.run(
    ['--session', 'tide-alerts', 'grant', '--reading', 'covers merges and nothing else'],
    ownerEnv,
    { stdin: true, stdout: true },
  );

  const result = await ctx.run(['--session', 'tide-alerts', 'show', 'grant'], ctx.agentEnv);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: [
      'grant  from the owner in chat, words set on day 1 by agent, reading set on day 1',
      '  words (0m): "Merge it yourself."',
      '  reading (0m): covers merges and nothing else',
      '  journal: day 1 grant · day 1 grant · day 1 grant',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('it exits 2 for a parse error in say before it checks for an owner terminal', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['say', 'x', '--bogus'], {}, { stdin: false, stdout: false });

  expect(result).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: 'www: unknown flag "--bogus".\nRun: www help\n',
  });
});

test('it refuses say in an agent shell even with no store folder', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['say', 'x'], {}, { stdin: false, stdout: false });

  expect(result.exitCode).toBe(3);
});

test('it keeps an item with a saved result byte for byte when set gives only a note', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedItem(folder, {
    id: 't-a',
    claim: 'Write it',
    check: 'pid:5',
    atWrite: 'alive',
    last: 'gone',
  });

  const before = await ctx.readTree();
  const saved = await readStore(folder);

  ctx.advance(3_600_000);

  const result = await ctx.run(['set', 't-a', '--note', 'Stop the simulator first']);
  const after = await ctx.readTree();

  expect({
    result: result.stdout,
    saved: saved.kind === 'store' && saved.store.items.map((item) => [item.atWrite, item.last]),
    itemsKept: after['tide-alerts/items.tsv'] === before['tide-alerts/items.tsv'],
  }).toStrictEqual({
    result: 't-a  note, 24 of 400. Brief: 7 lines.\n',
    saved: [['alive', 'gone']],
    itemsKept: true,
  });
});

test('it removes the notes.tsv row when a close finishes, and leaves each note row in the journal', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');
  const emptyNotes = createTempDir('empty-notes').path;

  seedStoreFile(emptyNotes, 'notes.tsv', formatNotesFile([]));

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it', '--note', 'First note', '--owed']);
  await ctx.run(['set', 't-a', '--note', 'Second note']);

  const before = await ctx.readTree();

  await ctx.run(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  const after = await ctx.readTree();
  const emptyTree = await readTreeHashes(emptyNotes);
  const noteRows = await readJournalRows(folder, (row) => row.op === 'note');

  expect({
    hadNotes: before['tide-alerts/notes.tsv'] !== emptyTree['notes.tsv'],
    notes: after['tide-alerts/notes.tsv'] === emptyTree['notes.tsv'],
    noteRows,
  }).toStrictEqual({
    hadNotes: true,
    notes: true,
    noteRows: [
      {
        ts: expect.any(String),
        op: 'note',
        id: 't-a',
        by: 'agent',
        text: 'First note',
        why: null,
        extra: 'owed=1',
      },
      {
        ts: expect.any(String),
        op: 'note',
        id: 't-a',
        by: 'agent',
        text: 'Second note',
        why: null,
        extra: null,
      },
    ],
  });
});

test('it runs each command of the older-note line as printed', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it', '--note', 'Stop the simulator first']);

  ctx.advance(3_600_000);

  const replaced = await ctx.run(['set', 't-a', 'Written another way']);

  const line = replaced.stdout.split('\n')[1] ?? '';

  const match = /Replace it with www (?<replace>.*), or clear it with www (?<clear>.*)$/u.exec(
    line,
  );

  const replaceWords = await readShellWords(match?.groups?.['replace'] ?? '');
  const clearWords = await readShellWords(match?.groups?.['clear'] ?? '');
  const replace = await ctx.run(replaceWords);
  const clear = await ctx.run(clearWords);

  expect({
    line,
    replace: [replaceWords, replace.exitCode],
    clear: [clearWords, clear.exitCode, clear.stdout],
  }).toStrictEqual({
    line: '  its note is 1h older than this claim. Replace it with www set t-a --note "<detail>", or clear it with www set t-a --no-note',
    replace: [['set', 't-a', '--note', '<detail>'], 0],
    clear: [['set', 't-a', '--no-note'], 0, 't-a  note cleared. Brief: 7 lines.\n'],
  });
});

test('it leaves an item open with no note when a task with a note stops after items.tsv, and writes the note on a rerun', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  await seedJournalRow(folder, {
    ts: '2026-03-10T11:43:02Z',
    op: 'note',
    id: 't-a',
    text: 'Stop the simulator first',
    why: null,
    extra: 'owed=1',
  });

  const afterStop = await ctx.run(['show', 't-a']);
  const brief = await ctx.run([]);

  const rerun = await ctx.run([
    'task',
    't-a',
    'Write it',
    '--note',
    'Stop the simulator first',
    '--owed',
  ]);

  const afterRerun = await ctx.run(['show', 't-a']);

  expect({ afterStop, brief, rerun, afterRerun }).toStrictEqual({
    afterStop: {
      exitCode: 0,
      stdout:
        't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  journal: day 1 task · day 1 note\n',
      stderr: '',
    },
    brief: {
      exitCode: 0,
      stdout: [
        'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks',
        'GOAL  Ship it',
        `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
        'NOW  none. Run: www now <id> "<next step>"',
        'OPEN (1 of 6)',
        '  t-a         Write it  [no check · 0m]',
        'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
        '',
      ].join('\n'),
      stderr: '',
    },
    rerun: {
      exitCode: 0,
      stdout: 't-a  task, open, no check, note 24 of 400, owed. Brief: 7 lines.\n',
      stderr: '',
    },
    afterRerun: {
      exitCode: 0,
      stdout:
        't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  owed note (0m): Stop the simulator first\n  journal: day 1 task · day 1 note · day 1 task · day 1 note\n',
      stderr: '',
    },
  });
});

test('it reads a closed item as closed and drops its notes.tsv row at the next notes write, when a close stops after items.tsv', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it', '--note', 'Stop the simulator first']);
  await ctx.run(['done', 't-a', '--evidence', 'commit 4c1d2e0']);

  seedStoreFile(
    folder,
    'notes.tsv',
    formatNotesFile([
      {
        id: 't-a',
        owed: false,
        written: '2026-03-10T11:43:01Z',
        note: 'Stop the simulator first',
      },
    ]),
  );

  const brief = await ctx.run([]);
  const shown = await ctx.run(['show', 't-a']);
  const next = await ctx.run(['task', 't-b', 'More', '--note', 'Another note']);
  const after = await readStore(folder);

  expect({
    brief,
    shown,
    next,
    notes: after.kind === 'store' && after.store.notes.map((note) => note.id),
  }).toStrictEqual({
    brief: {
      exitCode: 0,
      stdout: [
        'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · no checks',
        'GOAL  Ship it',
        `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
        'NOW  none. Run: www now <id> "<next step>"',
        'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
        '',
      ].join('\n'),
      stderr: '',
    },
    shown: {
      exitCode: 0,
      stdout: expect.stringMatching(/^t-a {2}closed: done on day 1, by agent\n/u),
      stderr: '',
    },
    next: {
      exitCode: 0,
      stdout: 't-b  task, open, no check, note 12 of 400. Brief: 7 lines.\n',
      stderr: '',
    },
    notes: ['t-b'],
  });
});

test('it keeps the journal row of a set with a note and writes the note on a rerun, when the write stops after the journal', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  await seedJournalRow(folder, {
    ts: '2026-03-10T11:43:02Z',
    op: 'note',
    id: 't-a',
    text: 'Stop the simulator first',
    why: null,
  });

  const afterStop = await ctx.run(['show', 't-a']);
  const rerun = await ctx.run(['set', 't-a', '--note', 'Stop the simulator first']);
  const afterRerun = await ctx.run(['show', 't-a']);

  expect({ afterStop, rerun, afterRerun }).toStrictEqual({
    afterStop: {
      exitCode: 0,
      stdout:
        't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  journal: day 1 task · day 1 note\n',
      stderr: '',
    },
    rerun: {
      exitCode: 0,
      stdout: 't-a  note, 24 of 400. Brief: 7 lines.\n',
      stderr: '',
    },
    afterRerun: {
      exitCode: 0,
      stdout:
        't-a  task, open since day 1, by agent\n  claim (0m): Write it\n  note (0m): Stop the simulator first\n  journal: day 1 task · day 1 note · day 1 note\n',
      stderr: '',
    },
  });
});
