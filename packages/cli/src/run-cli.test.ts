import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { z } from 'zod';
import { helpText } from './args/help-text.ts';
import { listCommandShapes } from './args/parse-cli-args.ts';
import { formatGateFile } from './hooks/format-gate-file.ts';
import { jsonVersion } from './json/json-version.ts';
import { nothingWrittenComment } from './refusals/format-refusal.ts';
import { findCredentialMatch } from './rules/find-credential-match.ts';
import { runCLI } from './run-cli.ts';
import { withBindingLock } from './sessions/with-binding-lock.ts';
import { formatLessonsFile } from './store/format-lessons-file.ts';
import { formatNotesFile } from './store/format-notes-file.ts';
import { parseItemsFile } from './store/parse-items-file.ts';
import { parseJournalFile } from './store/parse-journal-file.ts';
import { readJournalRows } from './store/read-journal-rows.ts';
import { readStore } from './store/read-store.ts';
import { withStoreLock } from './store/with-store-lock.ts';
import { buildCredentialSamples } from './test-utils/build-credential-samples.ts';
import { buildFilledRunArgv } from './test-utils/build-filled-run-argv.ts';
import { buildGrantFaultCases, faultCredential } from './test-utils/build-grant-fault-cases.ts';
import { buildMockIDs } from './test-utils/build-mock-ids.ts';
import { buildPrintSites } from './test-utils/build-print-sites.ts';
import {
  buildRedactionFields,
  buildRedactionValues,
  isPlaceholderField,
} from './test-utils/build-redaction-fields.ts';
import { buildSampleRunArgv } from './test-utils/build-sample-run-argv.ts';
import { buildShortOpsValue } from './test-utils/build-short-ops-value.ts';
import { buildSpacedText } from './test-utils/build-spaced-text.ts';
import { getSteeringWords } from './test-utils/get-steering-words.ts';
import { readBriefFigure } from './test-utils/read-brief-figure.ts';
import { readChangedPaths } from './test-utils/read-changed-paths.ts';
import { readShellWords } from './test-utils/read-shell-words.ts';
import { readTreeHashes } from './test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from './test-utils/seed-format-1-store.ts';
import { seedGhAnswers } from './test-utils/seed-gh-answers.ts';
import { seedGitRepo } from './test-utils/seed-git-repo.ts';
import { seedItem } from './test-utils/seed-item.ts';
import { seedJournalRow } from './test-utils/seed-journal-row.ts';
import { seedJsonCaseStore } from './test-utils/seed-json-case-store.ts';
import type { JsonCase } from './test-utils/seed-json-case-store.ts';
import { seedLockFile } from './test-utils/seed-lock-file.ts';
import { seedRedactionStore } from './test-utils/seed-redaction-store.ts';
import { seedStoreFile } from './test-utils/seed-store-file.ts';
import { seedStubCommand } from './test-utils/seed-stub-command.ts';
import { seedTasks } from './test-utils/seed-tasks.ts';
import { seedWorstCaseStore } from './test-utils/seed-worst-case-store.ts';
import type { CLIResult } from './types.ts';

function setupTest() {
  const root = createTempDir('run-cli').path;
  const stateRoot = join(root, 'wherewerewe');
  const agentEnv = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };
  const fixedMs = clock.nowMs;

  return {
    root,
    stateRoot,
    agentEnv,
    readSource: (name: string) => Bun.file(join(import.meta.dir, '..', name)).text(),
    ownerEnv: { HOME: root, XDG_STATE_HOME: root },
    ownerTerminal: { stdin: true, stdout: true },
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

    // the result a read saved for t-a of tide-alerts, or null when no items.tsv reads
    readSavedResult: () => {
      try {
        const parsed = parseItemsFile(
          readFileSync(join(stateRoot, 'tide-alerts', 'items.tsv'), 'utf8'),
          '2',
        );

        return parsed.items.find((item) => item.id === 't-a')?.last ?? null;
      } catch {
        return null;
      }
    },

    // a store of its own under the test's folder, with the lesson, promise, owner's words and
    // decision of seedRedactionStore, then one command, all at one time
    runInRedactionStore: async (
      values: Readonly<Record<string, string>>,
      argv: readonly string[],
    ) => {
      const storeRoot = mkdtempSync(join(root, 'store-'));

      const env = {
        HOME: storeRoot,
        XDG_STATE_HOME: storeRoot,
        CLAUDE_CODE_SESSION_ID: 'a1b2-test',
      };

      // say and ack are the owner's: they run from a terminal outside any agent
      const isOwner = argv[0] === 'say' || argv[0] === 'ack';
      const ownerEnv = { HOME: storeRoot, XDG_STATE_HOME: storeRoot };
      const terminal = { stdin: false, stdout: false };

      await runCLI({
        argv: ['init', 'tide-alerts', '--goal', 'Ship it'],
        env,
        cwd: '/work',
        terminal,
        now: () => fixedMs,
      });

      await seedRedactionStore(join(storeRoot, 'wherewerewe', 'tide-alerts'), values);

      if (!isOwner) {
        return runCLI({ argv, env, cwd: '/work', terminal, now: () => fixedMs });
      }

      const ownerTerminal = { stdin: true, stdout: true };
      const scoped = ['--session', 'tide-alerts'];

      if (argv[0] === 'ack') {
        await runCLI({
          argv: [...scoped, 'say', 'Plain words please'],
          env: ownerEnv,
          cwd: '/work',
          terminal: ownerTerminal,
          now: () => fixedMs,
        });
      }

      return runCLI({
        argv: [...scoped, ...argv],
        env: ownerEnv,
        cwd: '/work',
        terminal: ownerTerminal,
        now: () => fixedMs,
      });
    },
    pickGrantLines: (stdout: string) =>
      stdout.split('\n').filter((line) => /^ {2}(?:may|not|never) /u.test(line)),
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

test('it prints the package version for --version alone, and exits 0', async () => {
  const ctx = setupTest();

  const manifestJSON: unknown = await Bun.file(join(import.meta.dir, '..', 'package.json')).json();

  const manifest = z.object({ version: z.string() }).parse(manifestJSON);

  const result = await ctx.run(['--version'], {});

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: `wherewerewe ${manifest.version}\n`,
    stderr: '',
  });
});

test('it refuses --version beside a command as a flag that command does not take', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['task', 't-a', 'A task', '--version'], {});

  expect(result).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: `www: task takes no --version flag. It takes --pr, --branch, --path, --pid, --note, --owed and --blocked-by.\nRun: www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]${nothingWrittenComment}\n`,
  });
});

test.each([
  {
    title: '--session beside it',
    argv: ['--session', 'tide-alerts', '--version'],
    run: 'www --session tide-alerts',
  },
  { title: '-- beside it', argv: ['--version', '--'], run: 'www' },
])('it refuses --version with $title as a flag the brief does not take', async (row) => {
  const ctx = setupTest();

  const result = await ctx.run(row.argv, {});

  expect(result).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: `www: the brief takes no --version flag. It takes --json.\nRun: ${row.run}\n`,
  });
});

test.each([
  [['taks'], `www: unknown command "taks".\nRun: www help${nothingWrittenComment}\n`],
  [['brief'], `www: unknown command "brief".\nRun: www help${nothingWrittenComment}\n`],
  [['brief', '--bogus'], `www: unknown command "brief".\nRun: www help${nothingWrittenComment}\n`],
  [['doctor', 'x'], 'www: doctor takes no arguments.\nRun: www doctor\n'],
  [
    ['task', 't-a'],
    `www: task takes <id> "<claim>".\nRun: www task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]${nothingWrittenComment}\n`,
  ],
  [
    ['list'],
    'www: list takes tasks, waits, approvals, rules, where, lessons, promises, words, notes, decisions or prs.\nRun: www list tasks\n',
  ],
  [
    ['list', 'bogus'],
    'www: list takes tasks, waits, approvals, rules, where, lessons, promises, words, notes, decisions or prs.\nRun: www list tasks\n',
  ],
  [['recap', 'x'], 'www: recap takes no arguments.\nRun: www recap [--since <t>]\n'],
  [['show', 'a', 'b'], 'www: show takes [<id>].\nRun: www show [<id>]\n'],
  [
    ['--session', 'sample', 'task', 'x', '--bogus'],
    `www: task takes no --bogus flag. It takes --pr, --branch, --path, --pid, --note, --owed and --blocked-by.\nRun: www --session sample task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]${nothingWrittenComment}\n`,
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
  { command: 'show', argv: ['show', '--session', 'sample'], isOwner: false },
  { command: 'show', argv: ['show', '--session', 'sample'], isOwner: true },
  { command: 'log', argv: ['log', '--session', 'sample'], isOwner: false },
  { command: 'recap', argv: ['recap', '--session', 'sample'], isOwner: false },
  { command: 'recap', argv: ['recap', '--session', 'sample'], isOwner: true },
  { command: 'goal', argv: ['goal', 'Ship more', '--session', 'sample'], isOwner: false },
  {
    command: 'grant',
    argv: ['grant', '--may', 'Go.', '--where', 'chat', '--reading', 'r', '--session', 'sample'],
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
  const folder = seedFormat1Store(ctx.stateRoot, 'sample');

  seedStoreFile(join(ctx.stateRoot, '.bindings'), 'claude-a1b2-test', 'name=sample\n');

  const stubDir = createTempDir('run-cli-format1-gh').path;
  const marker = join(stubDir, 'ran');

  seedStubCommand(stubDir, 'gh', `: > "${marker}"\nexit 1`);

  const itemsText = readFileSync(join(folder, 'items.tsv'), 'utf8');

  seedStoreFile(
    folder,
    'items.tsv',
    itemsText.replace(
      'Wire the valve relay test\t-\t',
      'Wire the valve relay test\tpr:garden-co/valves#12\t',
    ),
  );

  const before = await ctx.readTree();

  const agentEnv = { ...ctx.agentEnv, PATH: stubDir };
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
    probed: existsSync(marker),
    unchanged: after,
  }).toStrictEqual({
    exitCode: 5,
    stdout: '',
    isFormat1Refusal: true,
    probed: false,
    unchanged: before,
  });
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
      stderr: `www: refused: another write holds the lock on tide-alerts (pid ${String(process.pid)}). Try again.\nRun: www init tide-alerts --goal "Ship it"${nothingWrittenComment}\n`,
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
      stdout: 'goal set. Brief: 131 of 8000 tokens.\n',
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
      stdout: 'now: t-a. Brief: 144 of 8000 tokens.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'task',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['task', 't-a', 'Write it'],
    {
      env: {},
      stdout: 't-a  task, open, no check. Brief: 147 of 8000 tokens.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'wait',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['wait', 'w-a', 'Answer', '--who', 'owner'],
    {
      env: {},
      stdout: 'w-a  wait, open, no check. Brief: 146 of 8000 tokens.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'rule',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['rule', 'r-a', 'Run from api/'],
    {
      env: {},
      stdout: 'r-a  rule, open. Brief: 143 of 8000 tokens.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'where',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['where', 'wt-a', 'A worktree', '--path', '<STATE>'],
    {
      env: {},
      stdout: 'wt-a  where, open, checked now: exists. Brief: 152 of 8000 tokens.\n',
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
      stdout: 't-a  task, open, no check. Brief: 151 of 8000 tokens.\n',
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
      stdout: 't-a  done. Off the brief, kept in the journal. Brief: 128 of 8000 tokens.\n',
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
      stdout: 't-a  dropped. Off the brief, kept in the journal. Brief: 128 of 8000 tokens.\n',
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
      stdout: 'ok-merge  ok, open, no check. Brief: 156 of 8000 tokens.\n',
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
      stdout: 'ok-merge  used. Off the brief, kept in the journal. Brief: 128 of 8000 tokens.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'task --note',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['task', 't-a', 'Write it', '--note', 'Stop the simulator first', '--owed'],
    {
      env: {},
      stdout: 't-a  task, open, no check, note 24 of 400, owed. Brief: 150 of 8000 tokens.\n',
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
      stdout: 't-a  note, 24 of 400. Brief: 147 of 8000 tokens.\n',
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
      stdout:
        '    Stop the simulator first\nnow: t-a, with its note (0m). Brief: 159 of 8000 tokens.\n',
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
        '    Stop the simulator first\nt-a  done. Off the brief, kept in the journal with its note (0m). Brief: 128 of 8000 tokens.\n',
      changed: [
        'tide-alerts/items.tsv',
        'tide-alerts/journal.tsv',
        'tide-alerts/notes.tsv',
        'tide-alerts/session',
      ],
    },
  ],
  [
    'grant --may',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['grant', '--may', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'],
    {
      env: {},
      stdout:
        'grant: 18 of 700 characters in 1 of 12 bullets on 1 of 19 lines, reading 13 of 200. Brief: 110 of 8000 tokens.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'grant --reading',
    [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['grant', '--may', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'],
    ],
    ['grant', '--reading', 'covers merges and nothing else'],
    {
      env: {},
      stdout: 'grant reading: 30 of 200. Brief: 116 of 8000 tokens.\n',
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
      stdout: 'd-1  decision on t-a. Read it with: www show t-a. Brief: 164 of 8000 tokens.\n',
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
        `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
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

  const result = await ctx.run(
    argv.map((word) => word.replace('<STATE>', ctx.stateRoot)),
    { ...ctx.agentEnv, ...expected.env },
  );

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
    't-a  task, open, no check. Brief: 147 of 20000 tokens.\n',
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

  expect(result.stdout).toBe('t-a  task, open, no check. Brief: 147 of 20000 tokens.\n');
});

test('it replaces an open item of the same kind in place, keeping its row and replacing its check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'First claim', '--pid', String(process.pid)]);
  await ctx.run(['task', 't-b', 'Second claim']);
  await ctx.run(['task', 't-a', 'First claim, written again']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n').slice(4, 8)).toStrictEqual([
    'OPEN (2, max 30)',
    '  t-a         First claim, written again  [no check · 0m]',
    '  t-b         Second claim  [no check · 0m]',
    'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
  ]);
});

test('it keeps the kind, row and extra of an item when set replaces its claim, and keeps its check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['wait', 'w-a', 'Answer', '--who', 'vendor', '--pid', String(process.pid)]);
  await ctx.run(['set', 'w-a', 'Answer, in writing']);

  const brief = await ctx.run([]);

  const items = parseItemsFile(
    readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8'),
    '2',
  );

  expect(brief.stdout).toInclude('  w-a         Answer, in writing  [vendor · alive]\n');
  expect(items.items[0]?.extra.pid_start).toBeString();
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
  await ctx.run(['wait', 'w-a', 'Answer', '--who', 'vendor', '--pid', String(process.pid)]);
  await ctx.run(['done', 'w-a', '--evidence', 'the answer came']);

  const journal = readFileSync(join(ctx.stateRoot, 'tide-alerts', 'journal.tsv'), 'utf8');

  expect(journal).toBe(
    [
      'ts\top\tid\tby\ttext\twhy\textra',
      '2026-03-10T11:43:00Z\tinit\ttide-alerts\tagent\tShip it\t-\t-',
      '2026-03-10T11:43:00Z\tbind\ttide-alerts\tagent\tinit\t-\tharness=claude;agent=a1b2-test',
      `2026-03-10T11:43:01Z\twait\tw-a\tagent\tAnswer\t-\tcheck=pid:${String(process.pid)}`,
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
      stdout: 't-a  done. Off the brief, kept in the journal. Brief: 128 of 8000 tokens.\n',
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
    stderr: `www: refused: t-a closed on day 1. Pick a new id.\nRun: www task <new id> "Write it again"${nothingWrittenComment}\n`,
  });
});

test('it finds the interrupted close of a task whose id is the name of the session, and adds no second row', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 't-a');

  await ctx.run(['init', 't-a', '--goal', 'x']);
  await ctx.run(['--session', 't-a', 'task', 't-a', 'Write it']);

  await seedJournalRow(folder, {
    ts: '2026-03-10T11:43:02Z',
    op: 'drop',
    id: 't-a',
    text: 'Write it',
    why: 'again',
  });

  await ctx.run(['--session', 't-a', 'goal', 'Ship the parser']);

  const dropped = await ctx.run(['--session', 't-a', 'drop', 't-a', '--why', 'again']);
  const log = await ctx.run(['--session', 't-a', 'log', '--op', 'drop', '--id', 't-a']);

  expect({
    dropped: dropped.exitCode,
    rows: log.stdout.split('\n').filter((line) => line.startsWith('day ')).length,
  }).toStrictEqual({
    dropped: 0,
    rows: 1,
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
        '  checked now: unchecked · at write: not checked yet',
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
      stderr: `www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait, an approval or the grant.\nRun: www --session tide-alerts rule <id> "<what the owner said, as a rule>"${nothingWrittenComment}\n`,
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
      'o-1  owner note. It shows in every brief until you run: www --session tide-alerts ack o-1. Brief: 155 of 20000 tokens.\n',
    stderr: '',
  });
});

test('it names the agent as the writer of the words the format 2 upgrade set', async () => {
  const ctx = setupTest();

  seedFormat1Store(ctx.stateRoot, 'sample');

  await ctx.run([
    'import',
    'sample',
    '--may',
    'Merge the garden-api pull requests yourself.',
    '--where',
    'chat',
    '--reading',
    'covers garden-api merges',
  ]);

  const result = await ctx.run(['--session', 'sample', 'show', 'grant']);

  expect(result.stdout.split('\n').at(1)).toMatch(
    /^ {2}words \(\d+m\), set on day \d+ by agent:$/u,
  );
});

test("it names the agent as the writer of the words when the agent writes the owner's words again in the same second", async () => {
  const ctx = setupTest();
  const ownerEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };
  const grant = ['--may', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'];

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
      'grant  from the owner in chat',
      '  words (0m), set on day 1 by agent:',
      '  may    • Merge it yourself.',
      '  reading (0m), set on day 1: covers merges',
      '  journal: day 1 grant · day 1 grant',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('it names the agent as the writer of the words after the owner replaces the reading alone in the same second', async () => {
  const ctx = setupTest();
  const ownerEnv = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };
  const grant = ['--may', 'Merge it yourself.', '--where', 'chat', '--reading', 'covers merges'];

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
      'grant  from the owner in chat',
      '  words (0m), set on day 1 by agent:',
      '  may    • Merge it yourself.',
      '  reading (0m), set on day 1: covers merges and nothing else',
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
    stderr: `www: say takes no --bogus flag. It takes --on.\nRun: www say "<text>" [--on <id>]${nothingWrittenComment}\n`,
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
    result: 't-a  note, 24 of 400. Brief: 201 of 8000 tokens.\n',
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

  const line = replaced.stdout.split('\n')[0] ?? '';

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
    clear: [['set', 't-a', '--no-note'], 0, 't-a  note cleared. Brief: 151 of 8000 tokens.\n'],
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
        `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
        'NOW  none. Run: www now <id> "<next step>"',
        'OPEN (1, max 30)',
        '  t-a         Write it  [no check · 0m]',
        'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
        '',
      ].join('\n'),
      stderr: '',
    },
    rerun: {
      exitCode: 0,
      stdout: 't-a  task, open, no check, note 24 of 400, owed. Brief: 150 of 8000 tokens.\n',
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
        `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
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
      stdout: 't-b  task, open, no check, note 12 of 400. Brief: 146 of 8000 tokens.\n',
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
      stdout: 't-a  note, 24 of 400. Brief: 147 of 8000 tokens.\n',
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

test('it refuses recap with exit 4 and no output when no session is bound or named', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['recap'], ctx.ownerEnv);

  expect({ exitCode: result.exitCode, stdout: result.stdout }).toStrictEqual({
    exitCode: 4,
    stdout: '',
  });
});

test('it prints the recap from the rows that parse when one item row is broken, and says what it left out', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it', '--note', 'Stop the simulator first']);

  seedStoreFile(
    join(ctx.stateRoot, 'tide-alerts'),
    'items.tsv',
    `${readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8')}t-b\ttask\n`,
  );

  const result = await ctx.run(['recap']);

  expect({
    exitCode: result.exitCode,
    hasTask: result.stdout.includes(
      '  t-a         Write it\n    note (0m): Stop the simulator first\n',
    ),
    stderr: result.stderr,
  }).toStrictEqual({
    exitCode: 0,
    hasTask: true,
    stderr:
      "www: tide-alerts's items.tsv line 3 does not parse: expected 9 tab-separated columns, found 2. This read leaves out what it could not read. Fix the file by hand.\n",
  });
});

test('it refuses recap with exit 3 and the broken session file when started is no UTC time', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const session = readFileSync(join(folder, 'session'), 'utf8');

  seedStoreFile(folder, 'session', session.replace(/^started=.*$/mu, 'started=yesterday'));

  const result = await ctx.run(['recap']);

  expect(result).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr: `www: tide-alerts's session does not parse: the key started is not a UTC time. Fix the file by hand.\nRun: less ${folder}/session\n`,
  });
});

test('it refuses recap with exit 2 and no stack trace when --since names a day past year 9999', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['recap', '--since', 'day-100000002']);

  expect(result).toStrictEqual({
    exitCode: 2,
    stdout: '',
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www recap --since 24h\n',
  });
});

test('it prints a credential that crosses column 100 as the placeholder with no part of it left, and leaves out a note that holds one', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');
  const credential = ['xoxb', '-', '12345'].join('');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedItem(folder, { id: 't-a', claim: `${'c'.repeat(82)} ${credential} tail` });
  await seedItem(folder, { id: 't-b', claim: 'Draw it' });

  seedStoreFile(
    folder,
    'notes.tsv',
    formatNotesFile([
      { id: 't-a', owed: false, written: '2026-03-10T11:40:00Z', note: 'A plain note' },
      { id: 't-b', owed: false, written: '2026-03-10T11:41:00Z', note: `use ${credential}` },
    ]),
  );

  await seedJournalRow(folder, {
    ts: '2026-03-10T11:44:00Z',
    op: 'decide',
    id: 'd-1',
    text: `${'c'.repeat(90)} ${credential} tail`,
    why: 'plain',
  });

  await seedJournalRow(folder, {
    ts: '2026-03-10T11:45:00Z',
    op: 'done',
    id: 't-c',
    why: `${'c'.repeat(75)} ${credential} tail`,
  });

  const result = await ctx.run(['recap']);

  const lines = result.stdout.split('\n');

  expect({
    exitCode: result.exitCode,
    cut: lines.filter((line) => line.includes('c'.repeat(75))),
    leaked: lines.filter((line) => /xox|12345|use </u.test(line)),
    widest: Math.max(...lines.map((line) => line.split(/(?:)/u).length)),
    stderr: result.stderr,
  }).toStrictEqual({
    exitCode: 0,
    cut: [
      `  t-a         ${'c'.repeat(82)} <w…`,
      `  d-1  ${'c'.repeat(90)} <…`,
      `  t-c         done · ${'c'.repeat(75)} <w…`,
    ],
    leaked: [],
    widest: 100,
    stderr:
      "www: tide-alerts's notes.tsv line 3 does not parse: the note holds a credential. This read leaves out what it could not read. Fix the file by hand.\n",
  });
});

test.each([
  { title: 'an agent shell', env: 'agent' },
  { title: 'the owner terminal', env: 'owner' },
])('it runs no probe, takes no lock and writes no file in a recap from $title', async (row) => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');
  const stubDir = createTempDir('run-cli-gh').path;
  const marker = join(stubDir, 'ran');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--note', 'Stop first']);
  await ctx.run(['decide', 'Use a file', '--why', 'It is simple']);
  await ctx.run(['task', 't-b', 'Draw it']);
  await ctx.run(['done', 't-b', '--evidence', 'merged']);

  seedStubCommand(stubDir, 'gh', `: > "${marker}"\nexit 1`);
  seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

  const before = await ctx.readTree();

  const base = row.env === 'agent' ? ctx.agentEnv : ctx.ownerEnv;
  const terminal = row.env === 'agent' ? null : ctx.ownerTerminal;

  const result = await ctx.run(
    ['--session', 'tide-alerts', 'recap'],
    { ...base, PATH: stubDir },
    terminal,
  );

  const after = await ctx.readTree();

  expect({
    exitCode: result.exitCode,
    startsWithHeader: result.stdout.startsWith('tide-alerts · day 1 · recap since day 1 11:43Z'),
    probed: existsSync(marker),
    unchanged: after,
  }).toStrictEqual({ exitCode: 0, startsWithHeader: true, probed: false, unchanged: before });
});

test.each([
  { kind: 'tasks', heading: 'OPEN (' },
  { kind: 'waits', heading: 'WAITING (' },
  { kind: 'approvals', heading: 'APPROVED ONCE (' },
  { kind: 'rules', heading: 'RULES (' },
  { kind: 'where', heading: 'WHERE (' },
  { kind: 'lessons', heading: 'LESSONS (' },
  { kind: 'promises', heading: 'PROMISED (' },
  { kind: 'words', heading: 'WORDS (' },
  { kind: 'notes', heading: '  t-a ' },
  { kind: 'decisions', heading: 'DECISIONS (' },
  { kind: 'prs', heading: 'PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (' },
] as const)(
  'it runs no probe, takes no lock and writes no file in list $kind, and prints its heading',
  async (row) => {
    const ctx = setupTest();
    const folder = join(ctx.stateRoot, 'tide-alerts');
    const stubDir = createTempDir('run-cli-gh').path;
    const marker = join(stubDir, 'ran');

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--note', 'Stop first']);
    await ctx.run(['wait', 'w-a', 'Hear back', '--who', 'vendor', '--pr', 'acme/tool#8']);
    await ctx.run(['rule', 'r-a', 'Run from the repo root']);
    await ctx.run(['where', 'wh-a', 'A worktree']);
    await ctx.run(['lesson', 'l-a', 'Reseed first', '--why', 'A stale row passed']);
    await ctx.run(['promise', 'p-a', 'Cost table', '--to', 'owner', '--by', 'Friday']);
    await ctx.run(['words', 'w-b', 'Plain words', '--where', 'chat']);
    await ctx.run(['decide', 'Use a file', '--why', 'It is simple']);

    seedStubCommand(stubDir, 'gh', `: > "${marker}"\nexit 1`);
    seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

    const before = await ctx.readTree();
    const result = await ctx.run(['list', row.kind], { ...ctx.agentEnv, PATH: stubDir });
    const after = await ctx.readTree();

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      startsWithHeading: result.stdout.startsWith(row.heading),
      probed: existsSync(marker),
      unchanged: after,
    }).toStrictEqual({
      exitCode: 0,
      stderr: '',
      startsWithHeading: true,
      probed: false,
      unchanged: before,
    });
  },
);

test('it reads a store with none of lessons.tsv, promises.tsv and words.tsv as before, and creates none', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);
  await ctx.run(['rule', 'r-a', 'Run from the repo root']);
  await ctx.run(['decide', 'Use a file', '--why', 'It is simple']);

  const before = await ctx.readTree();

  const outputs = [
    await ctx.run([]),
    await ctx.run(['show', 't-a']),
    await ctx.run(['list', 'lessons']),
    await ctx.run(['list', 'promises']),
    await ctx.run(['list', 'words']),
    await ctx.run(['log']),
    await ctx.run(['recap']),
  ];

  const after = await ctx.readTree();

  expect({
    exitCodes: outputs.map((output) => output.exitCode),
    stderr: outputs.map((output) => output.stderr),
    sections: outputs[0]?.stdout
      .split('\n')
      .filter((line) => /^(?:WORDS|PROMISED|LESSONS) /u.test(line)),
    lists: outputs.slice(2, 5).map((output) => output.stdout),
    tree: after,
  }).toStrictEqual({
    exitCodes: outputs.map(() => 0),
    stderr: outputs.map(() => ''),
    sections: [],
    lists: ['LESSONS (0, max 5)\n', 'PROMISED (0, max 5)\n', 'WORDS (0, max 8)\n'],
    tree: before,
  });
});

test('it never opens prs.tsv in a recap', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  // Opening a pipe for reading waits for a writer, so a recap that opened prs.tsv would hang
  const prsPath = join(folder, 'prs.tsv');

  rmSync(prsPath, { force: true });

  Bun.spawnSync(['mkfifo', prsPath]);

  const result = await ctx.run(['--session', 'tide-alerts', 'recap']);

  expect([result.exitCode, result.stdout.startsWith('tide-alerts · day 1 · recap')]).toStrictEqual([
    0,
    true,
  ]);
});

test('it runs the command of each overflow line, and each prints the rows the recap left out', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  for (const number of [1, 2, 3, 4, 5, 6]) {
    await ctx.run([
      'task',
      `t-${String(number)}`,
      `Task ${String(number)}`,
      '--note',
      `note of t-${String(number)}`,
    ]);
  }

  await ctx.run(['rule', 'r-1', 'Run the tests from app/', '--note', 'note of r-1']);
  await ctx.run(['where', 'wh-1', 'A worktree in /tmp']);

  for (const number of [1, 2, 3, 4, 5, 6]) {
    await ctx.run(['decide', `choice ${String(number)}`, '--why', `reason ${String(number)}`]);
    await ctx.run(['where', `c-${String(number)}`, 'Close me']);
    await ctx.run(['done', `c-${String(number)}`, '--evidence', `evidence ${String(number)}`]);
  }

  const recap = await ctx.run(
    ['--session', 'tide-alerts', 'recap'],
    ctx.ownerEnv,
    ctx.ownerTerminal,
  );

  const commands = recap.stdout
    .split('\n')
    .filter((line) => /^ {2}and \d+ more/u.test(line))
    .map((line) => line.slice(line.indexOf(': www ') + 2));

  const outputs: { exitCode: number; stdout: string }[] = [];

  for (const command of commands) {
    const words = await readShellWords(command.slice('www '.length));
    const output = await ctx.run(words, ctx.ownerEnv, ctx.ownerTerminal);

    outputs.push(output);
  }

  expect({
    count: commands.length,
    exitCodes: outputs.map((output) => output.exitCode),
    hasNote: outputs[0]?.stdout.includes('note of t-1'),
    hasDecision: outputs[1]?.stdout.includes('choice 6'),
    hasClose: outputs[2]?.stdout.includes('c-6'),
  }).toStrictEqual({
    count: 3,
    exitCodes: [0, 0, 0],
    hasNote: true,
    hasDecision: true,
    hasClose: true,
  });
});

test('it runs the no-grant line, and the footer of a recap run with --session, from the owner terminal', async () => {
  const ctx = setupTest();
  const ownerEnv = ctx.ownerEnv;

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  const recap = await ctx.run(['--session', 'tide-alerts', 'recap'], ownerEnv, ctx.ownerTerminal);

  const lines = recap.stdout.split('\n');
  const grantLine = lines.find((line) => line.startsWith('GRANT  none. Run: ')) ?? '';
  const wholeLine = lines.find((line) => line.startsWith('Whole text: ')) ?? '';
  const correctLine = lines.find((line) => line.startsWith('Correct: ')) ?? '';

  const grant = await ctx.run(
    buildFilledRunArgv(grantLine.slice('GRANT  none. '.length), {}),
    ownerEnv,
    ctx.ownerTerminal,
  );

  const whole = await ctx.run(
    buildFilledRunArgv(`Run: ${wholeLine.slice('Whole text: '.length)}`, { '<id>': 't-a' }),
    ownerEnv,
    ctx.ownerTerminal,
  );

  const correct = await ctx.run(
    buildFilledRunArgv(
      `Run: ${correctLine.slice('Correct: '.length).replace(' [--on <id>]', '')}`,
      { '<text>': 'Ask me first' },
    ),
    ownerEnv,
    ctx.ownerTerminal,
  );

  expect({
    grant: grant.exitCode,
    wholeExit: whole.exitCode,
    wholeNamesItem: whole.stdout.includes('t-a'),
    correct: correct.exitCode,
  }).toStrictEqual({ grant: 0, wholeExit: 0, wholeNamesItem: true, correct: 0 });
});

test('it prints a footer with no --session for a recap in a bound session, and its show line runs there', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  const recap = await ctx.run(['recap']);

  const lines = recap.stdout.split('\n');
  const wholeLine = lines.find((line) => line.startsWith('Whole text: ')) ?? '';

  const whole = await ctx.run(
    buildFilledRunArgv(`Run: ${wholeLine.slice('Whole text: '.length)}`, { '<id>': 't-a' }),
  );

  expect({
    footer: lines.slice(-3),
    wholeExit: whole.exitCode,
  }).toStrictEqual({
    footer: ['Whole text: www show <id>', 'Correct: www say "<text>" [--on <id>]', ''],
    wholeExit: 0,
  });
});

test.each(buildCredentialSamples().map((entry) => [entry.name, entry.sample, entry.tail] as const))(
  'it prints no part of a %s credential in any place www echoes what it was given',
  async (_name, sample, tail) => {
    const ctx = setupTest();
    const folder = join(ctx.stateRoot, 'tide-alerts');

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    await seedItem(folder, { id: sample, claim: 'Write the parser' });

    const typed = [
      [sample],
      ['task', `--${sample}`],
      ['task', `--${sample}=x`],
      ['task', 't-a', 'Write it', '--note', sample],
      ['task', 't-a', 'Write it', `--note=${sample}`],
      ['log', '--since', sample],
      ['task', 't-a', sample],
      ['task', '--note', '-keep', '--', 't-a', `--may=${sample}`],
      ['show', sample],
      ['done', sample, '--evidence', 'PR 12'],
      ['--session', sample],
      [],
    ];

    const outputs = await Promise.all(typed.map((argv) => ctx.run(argv)));

    seedStoreFile(
      folder,
      'session',
      `${readFileSync(join(folder, 'session'), 'utf8')}${sample}=1\n`,
    );

    const storedKey = await ctx.run([]);

    const lines = [...outputs, storedKey].flatMap((result) =>
      `${result.stdout}${result.stderr}`.split('\n'),
    );

    expect({
      matched: lines.filter((line) => findCredentialMatch(line) !== null),
      leaked: lines.filter((line) => line.includes(tail)),
      storedKeyRedacted: storedKey.stderr.includes('the key <where the secret lives> is not in'),
    }).toStrictEqual({ matched: [], leaked: [], storedKeyRedacted: true });
  },
);

test('it prints the Run line of a broken store whose path holds a line break as one line that a shell reads back', async () => {
  const ctx = setupTest();
  const root = ctx.root;
  const stateHome = join(root, 'first\nsecond');
  const env = { HOME: root, XDG_STATE_HOME: stateHome, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };

  const run = (argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

  await run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const folder = join(stateHome, 'wherewerewe', 'tide-alerts');
  const session = readFileSync(join(folder, 'session'), 'utf8');

  seedStoreFile(folder, 'session', session.replace(/^started=.*$/mu, 'started=yesterday'));

  const refused = await run(['recap']);

  const lines = refused.stderr.split('\n');

  const words = await readShellWords((lines[1] ?? '').slice('Run: '.length));

  expect({ exitCode: refused.exitCode, lines: lines.length, words }).toStrictEqual({
    exitCode: 3,
    lines: 3,
    words: ['less', join(folder, 'session')],
  });
});

test('it writes a 30th task, refuses a 31st new task, and rewrites an open task with 30 open', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedTasks(join(ctx.stateRoot, 'tide-alerts'), 29);

  const thirtieth = await ctx.run(['task', 't-30', 'Thirtieth']);
  const thirtyFirst = await ctx.run(['task', 't-31', 'Thirty-first']);
  const rewritten = await ctx.run(['set', 't-30', 'Thirtieth, reworded']);

  expect({
    thirtieth: [thirtieth.exitCode, thirtieth.stderr],
    thirtyFirst: [thirtyFirst.exitCode, thirtyFirst.stderr.split('\n')[0]],
    rewritten: [rewritten.exitCode, rewritten.stderr],
  }).toStrictEqual({
    thirtieth: [0, ''],
    thirtyFirst: [
      3,
      'www: refused: the session holds 30 of 30 tasks. Close one, or replace one with www set.',
    ],
    rewritten: [0, ''],
  });
});

test('it refuses the 31st task with a Run line that runs, then writes it', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedTasks(join(ctx.stateRoot, 'tide-alerts'), 30);

  const refused = await ctx.run(['--session', 'tide-alerts', 'task', 't-31', 'Thirty-first']);

  const runLine = refused.stderr.split('\n')[1] ?? '';
  const oldest = buildMockIDs('t-', 30)[0] ?? '';
  const argv = buildFilledRunArgv(runLine, { '<PR, commit or test run>': 'commit 4c1d2e0' });

  const closed = await ctx.run(argv);
  const written = await ctx.run(['--session', 'tide-alerts', 'task', 't-31', 'Thirty-first']);

  expect({
    exitCode: refused.exitCode,
    runLine,
    closed: closed.exitCode,
    written: written.exitCode,
  }).toStrictEqual({
    exitCode: 3,
    runLine: `Run: www --session tide-alerts done ${oldest} --evidence "<PR, commit or test run>"${nothingWrittenComment}`,
    closed: 0,
    written: 0,
  });
});

test('it lists every open task with www show and a note whole', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);
  await ctx.run(['task', 't-b', 'Test it', '--note', 'Run the suite twice.', '--owed']);

  const result = await ctx.run(['show']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: [
      'OPEN (2, max 30)',
      '  t-b         Test it  [no check · 0m · owed]',
      '    owed note (0m): Run the suite twice.',
      '  t-a         Write it  [no check · 0m]',
      '',
    ].join('\n'),
    stderr: '',
  });
});

test('it refuses www show with no session with exit 4', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['show'], ctx.ownerEnv);

  expect({ exitCode: result.exitCode, stdout: result.stdout }).toStrictEqual({
    exitCode: 4,
    stdout: '',
  });
});

test('it lists the task rows that parse when one item row is broken, and names the row', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);

  seedStoreFile(
    join(ctx.stateRoot, 'tide-alerts'),
    'items.tsv',
    `${readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8')}t-b\ttask\n`,
  );

  const result = await ctx.run(['show']);

  expect(result).toStrictEqual({
    exitCode: 0,
    stdout: 'OPEN (1, max 30)\n  t-a         Write it  [no check · 0m]\n',
    stderr:
      "www: tide-alerts's items.tsv line 3 does not parse: expected 9 tab-separated columns, found 2. This read leaves out what it could not read. Fix the file by hand.\n",
  });
});

test.each(
  buildCredentialSamples()
    .slice(0, 3)
    .map((entry) => [entry.name, entry.sample, entry.tail] as const),
)(
  'it prints a %s credential in a claim as the placeholder in www show and in the brief, and drops a note row that holds one',
  async (_name, sample, tail) => {
    const ctx = setupTest();
    const folder = join(ctx.stateRoot, 'tide-alerts');

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Write it']);

    await seedItem(folder, { id: 't-b', claim: `Rotate ${sample} soon` });

    seedStoreFile(
      folder,
      'notes.tsv',
      `${formatNotesFile([])}t-a\t-\t2026-03-10T10:43:00Z\tholds ${sample}\n`,
    );

    const shown = await ctx.run(['show']);
    const brief = await ctx.run([]);

    const output = [shown, brief].map((result) => result.stdout + result.stderr).join('');

    expect({
      leaked: output.includes(tail),
      placeholderInShow: shown.stdout.includes('<where the secret lives>'),
      placeholderInBrief: brief.stdout.includes('<where the secret lives>'),
      namesNoteRow: shown.stderr.includes('the note holds a credential'),
    }).toStrictEqual({
      leaked: false,
      placeholderInShow: true,
      placeholderInBrief: true,
      namesNoteRow: true,
    });
  },
);

test('it counts the brief of its own host in a task write reply', async () => {
  const ctx = setupTest();

  const codexEnv = {
    HOME: ctx.agentEnv.HOME,
    XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME,
    CODEX_SESSION_ID: 'c9-test',
  };

  await seedWorstCaseStore(ctx.run, ctx.stateRoot, 'tide-alerts', { taskCount: 20 });

  await ctx.run(['attach', 'tide-alerts'], codexEnv);

  const claudeReply = await ctx.run(['task', 't-w1', 'One more']);
  const claudeBrief = await ctx.run([]);
  const codexReply = await ctx.run(['task', 't-w2', 'And another'], codexEnv);
  const codexBrief = await ctx.run([], codexEnv);

  const claudeTokens = Math.ceil(Buffer.byteLength(claudeBrief.stdout) / 3);
  const codexTokens = Math.ceil(Buffer.byteLength(codexBrief.stdout) / 3);

  expect({
    claudeReply: readBriefFigure(claudeReply.stdout),
    codexReply: readBriefFigure(codexReply.stdout),
  }).toStrictEqual({
    claudeReply: { tokens: expect.toBeWithin(claudeTokens - 20, claudeTokens + 21), limit: 8000 },
    codexReply: { tokens: expect.toBeWithin(codexTokens - 20, codexTokens + 21), limit: 10_000 },
  });
});

test.each([
  { host: 'Codex', env: { CODEX_SESSION_ID: 'c9-test' }, limit: 10_000 },
  { host: 'Claude Code', env: { CLAUDE_CODE_SESSION_ID: 'a1b2-test' }, limit: 8000 },
])('it counts the brief that www --session prints in a $host task write reply', async (row) => {
  const ctx = setupTest();
  const name = 'n'.repeat(24);
  const env = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME, ...row.env };

  await seedWorstCaseStore(ctx.run, ctx.stateRoot, name, { taskCount: 29 });

  await ctx.run(['attach', name], env);

  const reply = await ctx.run(['--session', name, 'task', 't-w1', 'One more'], env);
  const brief = await ctx.run(['--session', name], env);

  const tokens = Math.ceil(Buffer.byteLength(brief.stdout) / 3);

  expect(readBriefFigure(reply.stdout)).toStrictEqual({
    tokens: expect.toBeWithin(tokens - 20, tokens + 21),
    limit: row.limit,
  });
});

test.each([
  {
    title: 'the owner terminal, which has no agent variable',
    host: 'none',
    maxBytes: 60_000,
  },
  { title: 'a Codex session', host: 'codex', maxBytes: 30_000 },
  { title: 'a Claude Code session', host: 'claude', maxBytes: 24_000 },
  { title: 'both agent variables', host: 'both', maxBytes: 24_000 },
] as const)('it prints the brief of $title within its byte limit', async (row) => {
  const ctx = setupTest();
  const base = { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME };

  const envs = {
    none: { ...base, WHEREWEREWE_SESSION: 'tide-alerts' },
    codex: { ...base, CODEX_SESSION_ID: 'c9-test' },
    claude: { ...base, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    both: { ...base, CLAUDE_CODE_SESSION_ID: 'a1b2-test', CODEX_SESSION_ID: 'c9-test' },
  };

  await seedWorstCaseStore(ctx.run, ctx.stateRoot, 'tide-alerts', { taskCount: 30 });

  await ctx.run(['attach', 'tide-alerts'], envs.codex);

  const brief = await ctx.run([], envs[row.host]);

  expect(Buffer.byteLength(brief.stdout)).toBeWithin(5000, row.maxBytes + 1);
});

test('it prints a count line whose command runs as printed, with and without --session', async () => {
  const ctx = setupTest();
  const name = 'n'.repeat(24);

  await seedWorstCaseStore(ctx.run, ctx.stateRoot, name, {
    taskCount: 30,
    claim: 'あ'.repeat(120),
  });

  const named = await ctx.run(['--session', name]);

  const countLine = named.stdout.split('\n').find((line) => line.includes('more open tasks')) ?? '';

  const words = await readShellWords(countLine.slice(countLine.indexOf(': ') + 2));
  const listed = await ctx.run(words.slice(1));
  const bound = await ctx.run([]);

  const boundLine = bound.stdout.split('\n').find((line) => line.includes('more open tasks')) ?? '';

  const boundWords = await readShellWords(boundLine.slice(boundLine.indexOf(': ') + 2));
  const boundList = await ctx.run(boundWords.slice(1));

  expect({
    namedLine: countLine,
    namedWithinLimit: Buffer.byteLength(named.stdout) <= 24_000,
    listedExit: listed.exitCode,
    listedAll: buildMockIDs('task', 30).every((id) => listed.stdout.includes(id)),
    boundLine,
    boundListExit: boundList.exitCode,
    boundListAll: buildMockIDs('task', 30).every((id) => boundList.stdout.includes(id)),
  }).toStrictEqual({
    namedLine: expect.stringMatching(
      new RegExp(`^ {2}and \\d+ more open tasks: www --session ${name} show$`, 'u'),
    ),
    namedWithinLimit: true,
    listedExit: 0,
    listedAll: true,
    boundLine: expect.stringMatching(/^ {2}and \d+ more open tasks: www show$/u),
    boundListExit: 0,
    boundListAll: true,
  });
});

test('it prints more task rows to a Codex session than to a Claude Code session, and each count line runs as printed', async () => {
  const ctx = setupTest();

  const codexEnv = {
    HOME: ctx.agentEnv.HOME,
    XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME,
    CODEX_SESSION_ID: 'c9-test',
  };

  await seedWorstCaseStore(ctx.run, ctx.stateRoot, 'tide-alerts', {
    taskCount: 30,
    claim: 'あ'.repeat(120),
  });

  await ctx.run(['attach', 'tide-alerts'], codexEnv);

  const claude = await ctx.run([]);
  const codex = await ctx.run([], codexEnv);

  const allIDs = buildMockIDs('task', 30);

  const listCommand = async (brief: CLIResult, env: Record<string, string | undefined>) => {
    const line =
      brief.stdout.split('\n').find((candidate) => candidate.includes('more open tasks')) ?? '';

    const words = await readShellWords(line.slice(line.indexOf(': ') + 2));

    return ctx.run(words.slice(1), env);
  };

  const claudeList = await listCommand(claude, ctx.agentEnv);

  const taskRow = /^ {2}task\d\d/u;
  const claudeRows = claude.stdout.split('\n').filter((line) => taskRow.test(line));
  const codexRows = codex.stdout.split('\n').filter((line) => taskRow.test(line));

  expect({
    codexMore: codexRows.length > claudeRows.length,
    claudeCount: claude.stdout.includes('more open tasks: www show'),
    claudeList: {
      exitCode: claudeList.exitCode,
      hasEveryID: allIDs.every((id) => claudeList.stdout.includes(id)),
    },
  }).toStrictEqual({
    codexMore: true,
    claudeCount: true,
    claudeList: { exitCode: 0, hasEveryID: true },
  });
});

test('it writes a grant of only --not and prints it in the brief, show grant and the recap, and keeps it when the reading changes', async () => {
  const ctx = setupTest();
  const bullet = 'replant the north beds before the soil report is in';

  const reading =
    'covers nothing yet; kept back: replanting the north beds until the soil report is in';

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const written = await ctx.run([
    'grant',
    '--not',
    bullet,
    '--where',
    'chat',
    '--reading',
    reading,
  ]);

  const brief = await ctx.run([]);
  const shown = await ctx.run(['show', 'grant']);
  const recap = await ctx.run(['recap']);
  const changed = await ctx.run(['grant', '--reading', 'covers nothing yet']);
  const after = await ctx.run([]);

  expect({
    written: [
      written.exitCode,
      written.stdout.replace(/Brief: \d+ of \d+ tokens\./u, 'Brief: <n> of <limit> tokens.'),
    ],
    briefLines: brief.stdout
      .split('\n')
      .filter(
        (line) => line.startsWith('GRANT') || line.startsWith('  not') || line.startsWith('  may'),
      ),
    briefReading: brief.stdout.includes(`  reading: ${reading}\n`),
    shown: [
      shown.exitCode,
      shown.stdout.includes(`  not    • ${bullet}\n`),
      shown.stdout.includes('grant  from the owner in chat'),
    ],
    recap: [recap.exitCode, recap.stdout.includes(`  not    • ${bullet}\n`)],
    changed: changed.exitCode,
    afterLines: after.stdout.split('\n').filter((line) => line.startsWith('  not')),
  }).toStrictEqual({
    written: [
      0,
      'grant: 51 of 700 characters in 1 of 12 bullets on 1 of 19 lines, reading 84 of 200. Brief: <n> of <limit> tokens.\n',
    ],
    briefLines: [
      expect.stringMatching(/^GRANT {2}from the owner in chat, /u),
      `  not    • ${bullet}`,
    ],
    briefReading: true,
    shown: [0, true, true],
    recap: [0, true],
    changed: 0,
    afterLines: [`  not    • ${bullet}`],
  });
});

test.each([
  {
    title: 'only --never',
    bullets: [
      ['--never', 'skip the gate'],
      ['--never', 'no night watering'],
    ],
    reply:
      'grant: 30 of 700 characters in 2 of 12 bullets on 1 of 19 lines, reading 18 of 200. Brief: <n> of <limit> tokens.\n',
    lines: ['  never  • skip the gate  • no night watering'],
  },
  {
    title: '--not with --never',
    bullets: [
      ['--not', 'replant the north beds before the soil report is in'],
      ['--never', 'prune the roses'],
    ],
    reply:
      'grant: 66 of 700 characters in 2 of 12 bullets on 2 of 19 lines, reading 18 of 200. Brief: <n> of <limit> tokens.\n',
    lines: [
      '  not    • replant the north beds before the soil report is in',
      '  never  • prune the roses',
    ],
  },
])(
  'it writes a grant of $title and prints it in the brief, show grant and the recap',
  async (row) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const written = await ctx.run([
      'grant',
      ...row.bullets.flat(),
      '--where',
      'chat',
      '--reading',
      'covers nothing yet',
    ]);

    const brief = await ctx.run([]);
    const shown = await ctx.run(['show', 'grant']);
    const recap = await ctx.run(['recap']);

    expect({
      written: [
        written.exitCode,
        written.stdout.replace(/Brief: \d+ of \d+ tokens\./u, 'Brief: <n> of <limit> tokens.'),
      ],
      brief: ctx.pickGrantLines(brief.stdout),
      shown: [shown.exitCode, ctx.pickGrantLines(shown.stdout)],
      recap: [recap.exitCode, ctx.pickGrantLines(recap.stdout)],
      hasNone: brief.stdout.includes('GRANT  none'),
    }).toStrictEqual({
      written: [0, row.reply],
      brief: [...row.lines],
      shown: [0, [...row.lines]],
      recap: [0, [...row.lines]],
      hasNone: false,
    });
  },
);

test.each(buildGrantFaultCases().map((entry) => [entry.title, entry.argv] as const))(
  'it prints Run lines that pass once filled, for the grant faults %s',
  async (_title, argv) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const refused = await ctx.run(argv);

    const runLines = refused.stderr.split('\n').filter((line) => line.startsWith('Run: www'));

    const retries = await Promise.all(
      runLines.map(async (line) => {
        const retried = await ctx.run(buildSampleRunArgv(line));

        return retried.exitCode;
      }),
    );

    // a line break alone is no fault in a bullet: the write turns it into a space and passes
    const isWritten = refused.exitCode === 0;

    expect({
      runLines: runLines.length,
      retries,
      credential: refused.stderr.includes(faultCredential),
      marked: runLines.filter((line) => line.includes('•')),
    }).toStrictEqual({
      runLines: isWritten ? 0 : 1,
      retries: isWritten ? [] : [0],
      credential: false,
      marked: [],
    });
  },
);

test('it refuses a grant of 20 lines with a Run line that runs once filled', async () => {
  const ctx = setupTest();
  const words = buildSpacedText(649, 74);
  const ones = Array.from({ length: 11 }, () => ['--may', 'o']).flat();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run([
    'grant',
    '--may',
    words,
    ...ones,
    '--where',
    'chat',
    '--reading',
    'covers watering',
  ]);

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const retried = await ctx.run(
    buildFilledRunArgv(line, { '<what the owner allows, in their words>': 'water the beds' }),
  );

  expect({
    exitCode: refused.exitCode,
    first: refused.stderr.split('\n')[0],
    line,
    retried: retried.exitCode,
  }).toStrictEqual({
    exitCode: 3,
    first:
      'www: refused: the grant takes 20 lines in the brief, and the limit is 19. Join short parts that belong together in one bullet, or put a long part in fewer words.',
    line: `Run: www grant --may "<what the owner allows, in their words>" --where chat --reading "covers watering"${nothingWrittenComment}`,
    retried: 0,
  });
});

test('it refuses a grant with no bullet with a Run line that adds --may and runs once filled', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run([
    'grant',
    '--scope',
    'in garden-api',
    '--where',
    'chat',
    '--reading',
    'covers nothing yet',
  ]);

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const retried = await ctx.run(
    buildFilledRunArgv(line, { '<what the owner allows, in their words>': 'water the beds' }),
  );

  expect({
    exitCode: refused.exitCode,
    stderr: refused.stderr,
    retried: retried.exitCode,
  }).toStrictEqual({
    exitCode: 3,
    stderr: `www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www grant --scope "in garden-api" --where chat --reading "covers nothing yet" --may "<what the owner allows, in their words>"${nothingWrittenComment}\n`,
    retried: 0,
  });
});

test('it prints no part of a credential inside a bullet of 160 characters, and a Run line that keeps the place', async () => {
  const ctx = setupTest();
  const credential = buildCredentialSamples().find((entry) => entry.name === 'ghp');
  const sample = credential?.sample ?? '';
  const padding = 160 - sample.length - 2;
  const bullet = `${'a'.repeat(Math.floor(padding / 2))} ${sample} ${'b'.repeat(Math.ceil(padding / 2))}`;

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run([
    'grant',
    '--may',
    bullet,
    '--where',
    'chat',
    '--reading',
    'covers watering',
  ]);

  expect({
    exitCode: refused.exitCode,
    stderr: refused.stderr,
    stdout: refused.stdout,
    leaked: `${refused.stdout}${refused.stderr}`.includes(credential?.tail ?? ''),
  }).toStrictEqual({
    exitCode: 3,
    stderr: `www: refused: the text looks like a credential (it matches the ghp pattern). Write where the secret lives, never its value.\nRun: www grant --may "<where the secret lives>" --where chat --reading "covers watering"${nothingWrittenComment}\n`,
    stdout: '',
    leaked: false,
  });
});

test.each([
  { command: 'now', argv: ['now', 't-a', 'go on'] },
  { command: 'set', argv: ['set', 't-a', 'Write it again'] },
  { command: 'done', argv: ['done', 't-a', '--evidence', 'merged'] },
])(
  'it ends the reply of $command on an item with a 400-character note with its status line',
  async (row) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Write it', '--note', buildSpacedText(400)]);

    const result = await ctx.run(row.argv);

    const lines = result.stdout.trimEnd().split('\n');

    expect({
      exitCode: result.exitCode,
      last: /Brief: \d+ of \d+ tokens\.$/u.test(lines.at(-1) ?? ''),
      statusLines: lines.filter((line) => /Brief: \d+ of \d+ tokens\.$/u.test(line)).length,
      firstIsNote: (lines[0] ?? '').startsWith('    ') || (lines[0] ?? '').startsWith('  its note'),
    }).toStrictEqual({ exitCode: 0, last: true, statusLines: 1, firstIsNote: true });
  },
);

test('it fills at_write and last of two checks that were never run, and writes no changed row', async () => {
  const ctx = setupTest();
  const bin = createTempDir('run-cli-old-store').path;

  const repo = await seedGitRepo(ctx.stateRoot);

  linkCommands(bin, ['git']);
  seedGhAnswers(bin, { 'bosunhq/bosun-api#77': 'OPEN passing' });

  const env = { ...ctx.agentEnv, PATH: bin };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env);
  await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#77'], env);
  await ctx.run(['where', 'wt-a', 'A tree', '--path', repo.folder], env);

  const folder = join(ctx.stateRoot, 'tide-alerts');
  const itemsPath = join(folder, 'items.tsv');

  writeFileSync(
    itemsPath,
    readFileSync(itemsPath, 'utf8')
      .split('\n')
      .map((line, row) =>
        row === 0 || line === ''
          ? line
          : line
              .split('\t')
              .map((cell, index) => (index === 4 || index === 5 ? '-' : cell))
              .join('\t'),
      )
      .join('\n'),
  );

  const brief = await ctx.run([], env);

  const items = parseItemsFile(readFileSync(itemsPath, 'utf8'), '2').items;
  const journal = readFileSync(join(folder, 'journal.tsv'), 'utf8');

  expect({
    exitCode: brief.exitCode,
    hasChanged: brief.stdout.includes('CHANGED SINCE WRITTEN'),
    filled: items.map((item) => [item.atWrite, item.last]),
    changedRows: journal.split('\n').filter((line) => line.split('\t')[1] === 'changed').length,
  }).toStrictEqual({
    exitCode: 0,
    hasChanged: false,
    filled: [
      ['OPEN passing', 'OPEN passing'],
      ['clean', 'clean'],
    ],
    changedRows: 0,
  });
});

test('it prints a header with the count of checks and never says not run yet', async () => {
  const ctx = setupTest();
  const bin = createTempDir('run-cli-header').path;

  seedGhAnswers(bin, { 'bosunhq/bosun-api#77': 'OPEN passing' });

  const env = { ...ctx.agentEnv, PATH: bin };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env);
  await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#77'], env);

  const brief = await ctx.run([], env);

  const header = brief.stdout.split('\n')[0] ?? '';

  expect({
    exitCode: brief.exitCode,
    counts: /· 1 checks in \d+\.\ds(?: · 1 unchecked: gh missing)?$/u.test(header),
    notRun: brief.stdout.includes('not run yet'),
  }).toStrictEqual({ exitCode: 0, counts: true, notRun: false });
});

test('it stores the result of a --pr write in at_write', async () => {
  const ctx = setupTest();
  const bin = createTempDir('run-cli-write-pr').path;

  seedGhAnswers(bin, { 'bosunhq/bosun-api#77': 'OPEN pending' });

  const env = { ...ctx.agentEnv, PATH: bin };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env);

  const result = await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#77'], env);
  const read = await readStore(join(ctx.stateRoot, 'tide-alerts'));

  expect({
    exitCode: result.exitCode,
    saved: read.kind === 'store' && read.store.items.map((item) => [item.id, item.atWrite]),
  }).toStrictEqual({ exitCode: 0, saved: [['pr-a', 'OPEN pending']] });
});

test('it stores the result of a --path write in at_write', async () => {
  const ctx = setupTest();
  const folder = createTempDir('run-cli-write-path').path;

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['where', 'wt-a', 'A tree', '--path', folder]);
  const read = await readStore(join(ctx.stateRoot, 'tide-alerts'));

  expect({
    exitCode: result.exitCode,
    saved: read.kind === 'store' && read.store.items.map((item) => [item.id, item.atWrite]),
  }).toStrictEqual({ exitCode: 0, saved: [['wt-a', 'exists']] });
});

test('it stores - in at_write when the probe of a --pr write reads unchecked', async () => {
  const ctx = setupTest();
  const bin = createTempDir('run-cli-write-unchecked').path;
  const env = { ...ctx.agentEnv, PATH: bin };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env);

  const result = await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#77'], env);

  const row = readFileSync(join(ctx.stateRoot, 'tide-alerts', 'items.tsv'), 'utf8')
    .split('\n')
    .find((line) => line.startsWith('pr-a\t'));

  expect({ exitCode: result.exitCode, cells: row?.split('\t').slice(4, 6) }).toStrictEqual({
    exitCode: 0,
    cells: ['-', '-'],
  });
});

test('it writes a lesson, a promise and the owner words, reads them in every read, and closes each with its own command', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await ctx.run([
    'lesson',
    'l-seed',
    'Reseed the staging table first',
    '--why',
    'A stale row passed',
  ]);

  await ctx.run(['promise', 'due-cost', 'Cost table', '--to', 'owner', '--by', 'day 10']);
  await ctx.run(['words', 'w-plain', 'Plain words in every reply', '--where', 'chat']);

  const brief = await ctx.run([]);
  const shown = await ctx.run(['show', 'due-cost']);
  const listed = await ctx.run(['list', 'lessons']);
  const logged = await ctx.run(['log', '--op', 'lesson,promise,words']);
  const recap = await ctx.run(['recap']);
  const refused = await ctx.run(['done', 'l-seed', '--evidence', 'merged']);
  const done = await ctx.run(['done', 'due-cost', '--evidence', 'sent']);
  const dropped = await ctx.run(['drop', 'l-seed', '--why', 'fixed in the seed script']);
  const after = await ctx.run(['list', 'lessons']);

  expect({
    sections: brief.stdout.split('\n').filter((line) => /^(?:WORDS|PROMISED|LESSONS) /u.test(line)),
    shown: shown.stdout.split('\n')[0],
    listed: listed.stdout,
    loggedOps: logged.stdout.split('\n').filter((line) => line.startsWith('day ')).length,
    recap: recap.stdout.split('\n').filter((line) => line.startsWith('PROMISED')),
    refused: [refused.exitCode, refused.stderr.split('\n').at(-2)],
    done: done.exitCode,
    dropped: dropped.exitCode,
    after: after.stdout,
  }).toStrictEqual({
    sections: ['WORDS (1, max 8)', 'PROMISED (1, max 5)', 'LESSONS (1, max 5)'],
    shown: 'due-cost  promise, open since day 1, by agent · to owner · by day 10',
    listed:
      'LESSONS (1, max 5)\n  l-seed      Reseed the staging table first  [why: A stale row passed]\n',
    loggedOps: 3,
    recap: ['PROMISED (1, max 5)'],
    refused: [3, `Run: www drop l-seed --why "<reason>"${nothingWrittenComment}`],
    done: 0,
    dropped: 0,
    after: 'LESSONS (0, max 5)\n',
  });
});

test.each(
  [...buildPrintSites(['l-1', 'p-1', 'p-2', 'w-1', 'd-1']).entries()].map(([index, site]) => ({
    title: site.title,
    argv: site.argv,
    index,
  })),
)(
  'it prints the stored texts of each kind through $title exactly as it prints a store that holds the placeholder in their place, whole or where the credential sat, and no credential',
  async (site) => {
    const ctx = setupTest();
    const fields = buildRedactionFields();

    const values = buildRedactionValues(
      fields.filter((field) => isPlaceholderField(field)),
      site.index,
    );

    const short = buildRedactionValues(
      fields.filter((field) => !isPlaceholderField(field)),
      site.index,
    );

    const leaked = await ctx.runInRedactionStore(values.credentials, site.argv);
    const whole = await ctx.runInRedactionStore(values.placeholders, site.argv);
    const inPlace = await ctx.runInRedactionStore(values.placedPlaceholders, site.argv);
    const shortLeaked = await ctx.runInRedactionStore(short.credentials, site.argv);
    const shortMarked = await ctx.runInRedactionStore(short.markers, site.argv);

    const printed = `${leaked.stdout}${leaked.stderr}${shortLeaked.stdout}${shortLeaked.stderr}`;
    const shortPrinted = `${shortLeaked.stdout}${shortLeaked.stderr}`;
    const markedPrinted = `${shortMarked.stdout}${shortMarked.stderr}`;

    const fourGrams = [...values.tails, ...short.tails].flatMap((tail) =>
      Array.from({ length: tail.length - 3 }, (_value, at) => tail.slice(at, at + 4)),
    );

    // a field of 16 characters cannot hold the placeholder in a store, so its site prints one
    // placeholder for each time it prints that field's plain value
    expect({
      result: leaked,
      leaks: fourGrams.filter((gram) => printed.includes(gram)),
      shortPlaceholders: shortPrinted.split('<where the secret lives>').length - 1,
    }).toStrictEqual({
      result: expect.toBeOneOf([whole, inPlace]),
      leaks: [],
      shortPlaceholders: Object.values(short.markers).reduce(
        (count, marker) => count + markedPrinted.split(marker).length - 1,
        0,
      ),
    });
  },
);

test.each(
  buildPrintSites(['l-1'])
    .filter((site) => ['say', 'ack', 'grant'].includes(site.argv[0] ?? ''))
    .map((site) => ({ title: site.title, argv: site.argv })),
)('it exits 0 for $title in the redaction store, so its reply is checked', async (site) => {
  const ctx = setupTest();

  const result = await ctx.runInRedactionStore({}, site.argv);

  expect(result.exitCode).toBe(0);
});

test.each(buildRedactionFields())(
  'it prints the $name field as one placeholder in www show of its row, and no credential, when only that field holds one',
  async (field) => {
    const ctx = setupTest();
    const values = buildRedactionValues([field], 0);

    const shown = await ctx.runInRedactionStore(values.credentials, ['show', field.id]);

    const printed = `${shown.stdout}${shown.stderr}`;
    const tail = values.tails[0] ?? '';

    expect({
      exitCode: shown.exitCode,
      placeholders: printed.split('<where the secret lives>').length - 1,
      leaks: Array.from({ length: tail.length - 3 }, (_value, at) => tail.slice(at, at + 4)).filter(
        (gram) => printed.includes(gram),
      ),
    }).toStrictEqual({ exitCode: 0, placeholders: 1, leaks: [] });
  },
);

test.each([
  {
    title: 'a lesson',
    argv: [
      'lesson',
      'l-seed',
      `Reseed ${buildShortOpsValue()}`,
      '--why',
      `why ${buildShortOpsValue()}`,
    ],
    list: ['list', 'lessons'],
    stdout: `LESSONS (1, max 5)\n  l-seed      Reseed ${buildShortOpsValue()}  [why: why ${buildShortOpsValue()}]\n`,
  },
  {
    title: 'a promise',
    argv: [
      'promise',
      'due-cost',
      `Cost ${buildShortOpsValue()}`,
      '--to',
      buildShortOpsValue(),
      '--by',
      `by ${buildShortOpsValue()}`,
    ],
    list: ['list', 'promises'],
    stdout: `PROMISED (1, max 5)\n  due-cost    Cost ${buildShortOpsValue()}  [to ${buildShortOpsValue()} · by by ${buildShortOpsValue()}]\n`,
  },
  {
    title: 'the owner words',
    argv: ['words', 'w-plain', `Plain ${buildShortOpsValue()}`, '--where', buildShortOpsValue()],
    list: ['list', 'words'],
    stdout: `WORDS (1, max 8)\n  w-plain     "Plain ${buildShortOpsValue()}"  [${buildShortOpsValue()} · 0m]\n`,
  },
] as const)(
  'it prints $title whose value ends in ops_ and 5 characters unchanged, with no run that forms a match',
  async (row) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const written = await ctx.run(row.argv);
    const listed = await ctx.run(row.list);

    expect({
      exitCode: written.exitCode,
      stdout: listed.stdout,
      stderr: listed.stderr,
    }).toStrictEqual({
      exitCode: 0,
      stdout: row.stdout,
      stderr: '',
    });
  },
);

test('it never prints the tail of a credential typed as the --session name', async () => {
  const ctx = setupTest();
  const [credential] = buildCredentialSamples();
  const name = (credential?.sample ?? '').slice(0, 20);

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['--session', name, 'list', 'rules']);

  expect(`${result.stdout}${result.stderr}`.includes(credential?.tail ?? 'zz')).toBe(false);
});

test('it holds no steering word in the new replies, refusals, cut lines, headings and help lines', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  seedStoreFile(
    join(ctx.stateRoot, 'tide-alerts'),
    'lessons.tsv',
    formatLessonsFile(
      buildMockIDs('less', 5).map((id) => ({
        id,
        text: 'A lesson',
        why: 'A mistake',
        written: '2026-03-09T09:00:00Z',
        by: 'agent' as const,
      })),
    ),
  );

  await ctx.run(['promise', 'due-cost', 'Cost table', '--to', 'owner', '--by', 'day 10']);
  await ctx.run(['words', 'w-plain', 'Plain words', '--where', 'chat']);

  const noGrantPaste = await ctx.run(['goal', '--paste']);

  await ctx.run([
    'grant',
    '--may',
    'merge the chart PRs once CI is green',
    '--never',
    'publish a release',
    '--scope',
    'in the sailing app',
    '--where',
    'chat',
    '--reading',
    'covers chart merges on green CI',
  ]);

  const outputs = [
    noGrantPaste,
    await ctx.run(['lesson', 'l-new', 'A lesson', '--why', 'A mistake']),
    await ctx.run(['lesson', 'l-new', 'A lesson']),
    await ctx.run(['promise', 'p-new', 'A promise']),
    await ctx.run(['promise', 'p-new', 'A promise', '--to', 'owner', '--by', 'Fri; Mon']),
    await ctx.run(['words', 'w-new', 'Plain words']),
    await ctx.run(['done', 'less01xxxxxxxxxx', '--evidence', 'merged']),
    await ctx.run(['done', 'w-plain', '--evidence', 'merged']),
    await ctx.run(['task', 'due-cost', 'A task']),
    await ctx.run(['lesson', 'due-cost', 'A lesson', '--why', 'A mistake']),
    await ctx.run(['list', 'bogus']),
    await ctx.run(['list', 'promises']),
    await ctx.run(['list', 'words']),
    await ctx.run(['--session', 'tide-alerts']),
    await ctx.run(['goal', '--paste']),
    await ctx.run(['goal', '--paste', 'Ship it']),
    await ctx.run(['goal', '--paste', '--json']),
    await ctx.run(['--bogus']),
    await ctx.run(['show', '--bogus']),
    await ctx.run(['log', '--bogus']),
    await ctx.run(['list', 'rules', '--bogus']),
    await ctx.run(['recap', '--bogus']),
    await ctx.run(['goal', 'Ship it', '--bogus']),
    await ctx.run(['task', 't-a', 'A task', '--json']),
    await ctx.run(['--version']),
  ];

  const text = outputs.map((output) => `${output.stdout}${output.stderr}`).join('\n');

  const newHelpLines = helpText
    .split('\n')
    .filter((line) =>
      /www list|every row of one kind|www lesson|www promise|www words|one screen for the owner|work on now|A lesson or the owner's words close|take --json|www goal --paste|^Setup:/u.test(
        line,
      ),
    );

  expect({
    exitCodes: outputs.map((output) => output.exitCode),
    steering: getSteeringWords(text),
    help: getSteeringWords(newHelpLines.join('\n')),
    jsonLine: newHelpLines.filter((line) => line.includes('take --json')),
    pasteLine: newHelpLines.filter((line) => line.includes('www goal --paste')),
    setupLine: newHelpLines.filter((line) => line.startsWith('Setup:')),
  }).toStrictEqual({
    exitCodes: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0],
    steering: [],
    help: [],
    jsonLine: [
      'www, show, log, list and recap take --json: one JSON value for a script, in place of the text.',
    ],
    pasteLine: [
      '  www goal --paste           print a /goal text of the grant, for the owner to paste',
    ],
    setupLine: ['Setup:   www install [--print]   www doctor   www --version'],
  });
});

test.each(
  (
    [
      'a whole store',
      'a notes row that does not parse',
      'a held lock',
      'a read-only store folder',
      'no session',
      'a format 1 store',
      'a hand-kept store',
      'a newer store',
      'a session that does not parse',
    ] satisfies JsonCase[]
  ).flatMap((state) =>
    [
      { command: 'www', argv: [] },
      { command: 'www show', argv: ['show'] },
      { command: 'www log', argv: ['log'] },
      { command: 'www list tasks', argv: ['list', 'tasks'] },
      { command: 'www recap', argv: ['recap'] },
    ].map((read) => ({
      command: read.command,
      argv: read.argv,
      state,
      saved:
        read.command === 'www' &&
        (state === 'a whole store' || state === 'a notes row that does not parse')
          ? 'exists'
          : null,
    })),
  ),
)('it exits $command --json with the code and stderr of its text form when $state', async (row) => {
  const text = setupTest();
  const json = setupTest();

  const restoreText = await seedJsonCaseStore(text.root, row.state);
  const restoreJson = await seedJsonCaseStore(json.root, row.state);

  const scoped = ['--session', 'tide-alerts', ...row.argv];

  const printedText = await text.run(scoped);
  const printedJSON = await json.run([...scoped, '--json']);

  const savedText = text.readSavedResult();
  const savedJSON = json.readSavedResult();

  restoreText();
  restoreJson();

  expect({
    exitCode: printedJSON.exitCode,
    stderr: printedJSON.stderr.replaceAll(json.root, '<ROOT>'),
    stdout: printedJSON.exitCode === 0 ? 'one line of JSON' : printedJSON.stdout,
    lines: printedJSON.stdout.split('\n').length,
    saved: savedJSON,
  }).toStrictEqual({
    exitCode: printedText.exitCode,
    stderr: printedText.stderr.replaceAll(text.root, '<ROOT>'),
    stdout: printedJSON.exitCode === 0 ? 'one line of JSON' : '',
    lines: printedJSON.exitCode === 0 ? 2 : 1,
    saved: row.saved,
  });

  expect(savedText).toBe(row.saved);

  expect((): unknown =>
    printedJSON.exitCode === 0 ? JSON.parse(printedJSON.stdout) : null,
  ).not.toThrow();
});

// the --json form's Run line keeps --json, the flag it typed, where the refused value lets it
test.each([
  { title: 'www log --since -2h --json', argv: ['log', '--since', '-2h'], kept: ' --json' },
  { title: 'www list --json', argv: ['list'], kept: '' },
])(
  'it exits $title with the code and stderr of its usage refusal and prints no JSON',
  async (row) => {
    const text = setupTest();
    const json = setupTest();

    const refusedText = await text.run(row.argv);
    const refusedJSON = await json.run([...row.argv, '--json']);

    expect({
      exitCode: refusedJSON.exitCode,
      stdout: refusedJSON.stdout,
      stderr: refusedJSON.stderr,
    }).toStrictEqual({
      exitCode: 2,
      stdout: '',
      stderr: refusedText.stderr.replace(/\n$/u, `${row.kept}\n`),
    });

    expect(refusedText.exitCode).toBe(2);
  },
);

test('it changes the files a read changes, and no more, with --json', async () => {
  const text = setupTest();
  const json = setupTest();

  const runSeedSteps = async (ctx: ReturnType<typeof setupTest>) => {
    const frozen = { env: ctx.agentEnv, now: () => Date.parse('2026-03-10T11:43:00Z') };

    await runCLI({
      argv: ['init', 'tide-alerts', '--goal', 'Ship it'],
      ...frozen,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
    });

    await seedItem(join(ctx.stateRoot, 'tide-alerts'), {
      id: 't-a',
      check: 'path:/work/no-such-folder-here',
      atWrite: 'exists',
      last: 'exists',
    });

    return frozen;
  };

  const frozenText = await runSeedSteps(text);
  const frozenJSON = await runSeedSteps(json);

  await runCLI({
    argv: [],
    ...frozenText,
    cwd: '/work',
    terminal: { stdin: false, stdout: false },
  });

  await runCLI({
    argv: ['--json'],
    ...frozenJSON,
    cwd: '/work',
    terminal: { stdin: false, stdout: false },
  });

  const jsonTree = await json.readTree();
  const textTree = await text.readTree();

  const changedRows = await readJournalRows(
    join(json.stateRoot, 'tide-alerts'),
    (row) => row.op === 'changed',
  );

  expect({
    sameFiles: jsonTree,
    changed: changedRows.map((row) => [row.id, row.text]),
  }).toStrictEqual({ sameFiles: textTree, changed: [['t-a', 'exists -> missing']] });
});

test.each([
  ['show', ['show', '--json']],
  ['log', ['log', '--json']],
  ['list', ['list', 'tasks', '--json']],
  ['recap', ['recap', '--json']],
])(
  'it takes no lock and changes no file for www %s --json while the lock is held',
  async (_name, argv) => {
    const ctx = setupTest();
    const folder = join(ctx.stateRoot, 'tide-alerts');

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Write it']);

    seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

    const before = await ctx.readTree();
    const printed = await ctx.run(argv);
    const after = await ctx.readTree();

    expect({ exitCode: printed.exitCode, unchanged: after }).toStrictEqual({
      exitCode: 0,
      unchanged: before,
    });
  },
);

test('it prints a claim that ends in ops_ and a few characters as JSON that parses', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedItem(folder, { id: 't-a', claim: 'Check the cache ops_abcde' });

  const printed = await ctx.run(['list', 'tasks', '--json']);

  const parsed: unknown = JSON.parse(printed.stdout);

  expect(parsed).toStrictEqual({
    ...jsonVersion,
    kind: 'tasks',
    rows: [
      {
        kind: 'task',
        row: expect.objectContaining({ id: 't-a', claim: 'Check the cache ops_abcde' }),
        note: null,
      },
    ],
  });
});

test('it prints no text of the new files through process.stdout or console', async () => {
  const ctx = setupTest();

  const names = [
    'src/commands/run-list-command.ts',
    'src/reads/render-list.ts',
    'src/writes/pick-lesson-write.ts',
    'src/writes/pick-promise-write.ts',
    'src/writes/pick-words-write.ts',
    'src/writes/pick-file-close.ts',
    'src/refusals/build-kind-refusal.ts',
    'src/commands/run-goal-paste-command.ts',
    'src/commands/refuse-no-session.ts',
    'src/reads/render-goal-paste.ts',
    'src/reads/format-failing-names.ts',
    'src/json/build-brief-json.ts',
    'src/json/build-grant-opts.ts',
    'src/json/build-list-json.ts',
    'src/json/build-log-json.ts',
    'src/json/build-recap-json.ts',
    'src/json/build-show-json.ts',
    'src/json/build-shown.ts',
    'src/json/format-json-output.ts',
  ];

  const texts = await Promise.all(names.map((name) => ctx.readSource(name)));

  expect(texts.filter((text) => /process\.stdout|console\./u.test(text))).toStrictEqual([]);
});

test('it refuses every write that names an id two files hold, prints both rows on a read, and keeps every file', async () => {
  const ctx = setupTest();
  const folder = join(ctx.stateRoot, 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'l-seed', 'A task that shares an id']);

  seedStoreFile(
    folder,
    'lessons.tsv',
    formatLessonsFile([
      {
        id: 'l-seed',
        text: 'A lesson',
        why: 'A mistake',
        written: '2026-03-09T09:00:00Z',
        by: 'agent',
      },
    ]),
  );

  const refusedArgvs = [
    ['set', 'l-seed', 'New claim'],
    ['done', 'l-seed', '--evidence', 'merged'],
    ['now', 'l-seed', 'go on'],
    ['lesson', 'l-seed', 'A lesson', '--why', 'A mistake'],
  ];

  const refusals = [];

  for (const argv of refusedArgvs) {
    const before = await ctx.readTree();
    const result = await ctx.run(argv);

    refusals.push({ result, before, after: await ctx.readTree() });
  }

  const other = await ctx.run(['task', 't-other', 'Another task']);
  const brief = await ctx.run([]);
  const listed = await ctx.run(['list', 'lessons']);

  const twice =
    'www: tide-alerts holds l-seed twice, as a task in items.tsv and as a lesson in lessons.tsv. Rename one of them by hand; the journal keeps both.\n';

  expect({
    refusals: refusals.map((refusal) => [
      refusal.result.exitCode,
      refusal.result.stderr.includes(' twice, as '),
    ]),
    trees: refusals.map((refusal) => refusal.after),
    other: other.exitCode,
    briefHasBoth: [
      brief.stdout.includes('  l-seed      A task'),
      listed.stdout.includes('A lesson'),
    ],
    briefStderr: brief.stderr.startsWith(twice),
  }).toStrictEqual({
    refusals: refusals.map(() => [3, true]),
    trees: refusals.map((refusal) => refusal.before),
    other: 0,
    briefHasBoth: [true, true],
    briefStderr: true,
  });
});

test('it records the drop of a task whose earlier drop row a stopped append cut short, on a line of its own', async () => {
  const ctx = setupTest();
  const journal = join(ctx.stateRoot, 'tide-alerts', 'journal.tsv');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write the parser']);

  writeFileSync(
    journal,
    `${readFileSync(journal, 'utf8')}2026-03-10T11:43:05Z\tdrop\tt-a\tagent\tWrite the parser`,
  );

  const dropped = await ctx.run(['drop', 't-a', '--why', 'not needed now']);
  const logged = await ctx.run(['log', '--op', 'drop', '--id', 't-a']);

  expect({
    dropped: dropped.exitCode,
    rows: logged.stdout.split('\n').filter((line) => line.includes('drop      t-a')).length,
    lastLines: readFileSync(journal, 'utf8')
      .split('\n')
      .slice(-3, -1)
      .map((line) => line.split('\t')[1]),
  }).toStrictEqual({ dropped: 0, rows: 1, lastLines: ['drop', 'drop'] });
});

test.each(['wiped', 'reading', 'cut', 'failed', 'read', 'open'] as const)(
  'it never writes the gate file from the brief, www --json or a write when the state is %s',
  async (state) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const path = join(ctx.stateRoot, '.gate', 'claude-a1b2-test');

    mkdirSync(join(ctx.stateRoot, '.gate'), { recursive: true });
    writeFileSync(path, formatGateFile({ state, session: 'tide-alerts', reads: 0, spare: 1 }));

    const before = { bytes: readFileSync(path, 'utf8'), mtimeMs: statSync(path).mtimeMs };

    await ctx.run([]);
    await ctx.run(['--json']);
    await ctx.run(['task', 't-a', 'Write it']);

    expect({ bytes: readFileSync(path, 'utf8'), mtimeMs: statSync(path).mtimeMs }).toStrictEqual(
      before,
    );
  },
);

test.each(
  listCommandShapes().flatMap((shape) =>
    shape.command === 'log' || shape.command === 'recap' ? [shape] : [],
  ),
)(
  'it keeps each flag $command takes on the Run line of a --since it cannot read',
  async (shape) => {
    const ctx = setupTest();
    const values: Readonly<Record<string, string>> = { op: 'set', id: 't-a' };

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const others = shape.taken.filter((flag) => flag !== 'since');

    const typed = others.flatMap((flag) => {
      const value = values[flag];

      return value === undefined ? [`--${flag}`] : [`--${flag}`, value];
    });

    const result = await ctx.run([shape.command, '--since', 'yesterday', ...typed]);

    const runLine = result.stderr.split('\n').find((line) => line.startsWith('Run: ')) ?? '';

    const words = await readShellWords(runLine.slice('Run: '.length));

    expect(words).toStrictEqual(['www', shape.command, '--since', '24h', ...typed]);
  },
);
