import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from './run-cli.ts';
import { readChangedPaths } from './test-utils/read-changed-paths.ts';
import { readTreeHashes } from './test-utils/read-tree-hashes.ts';
import { seedStoreFile } from './test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('run-cli').path;
  const stateRoot = join(root, 'wherewerewe');
  const agentEnv = { XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  return {
    stateRoot,
    agentEnv,
    run: (argv: readonly string[], env: Record<string, string | undefined> = agentEnv) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    readTree: () => readTreeHashes(stateRoot),
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

    expect<unknown>(result).toStrictEqual({ exitCode: 0, stdout: helpBlock, stderr: '' });
  },
);

test.each([
  [['taks'], 'www: unknown command "taks".\nRun: www help\n'],
  [['ok', 'ok-a'], 'www: "ok" comes in a later version of www.\nRun: www help\n'],
  [['task', 't-a'], 'www: task takes <id> "<claim>".\nRun: www help\n'],
])('it refuses %p with exit 2', async (argv, stderr) => {
  const ctx = setupTest();

  const result = await ctx.run(argv);

  expect(result).toStrictEqual({ exitCode: 2, stdout: '', stderr });
});

test('it refuses with exit 4 when neither XDG_STATE_HOME nor HOME names a store folder', async () => {
  const ctx = setupTest();

  const result = await ctx.run(['sessions'], {});

  expect(result).toStrictEqual({
    exitCode: 4,
    stdout: '',
    stderr: 'www: no store folder: set XDG_STATE_HOME or HOME.\nRun: www help\n',
  });
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
      stdout: 'goal set. Brief: 6 lines.\n',
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
      stdout: 'now: t-a. Brief: 9 lines.\n',
      changed: ['tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'task',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['task', 't-a', 'Write it'],
    {
      env: {},
      stdout: 't-a  task, open, no check. Brief: 8 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'wait',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['wait', 'w-a', 'Answer', '--who', 'owner'],
    {
      env: {},
      stdout: 'w-a  wait, open, no check. Brief: 8 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'rule',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['rule', 'r-a', 'Run from api/'],
    {
      env: {},
      stdout: 'r-a  rule, open. Brief: 8 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
    },
  ],
  [
    'where',
    [['init', 'tide-alerts', '--goal', 'Ship it']],
    ['where', 'wt-a', 'A worktree', '--path', '/srv/app'],
    {
      env: {},
      stdout: 'wt-a  where, open, no check run. Brief: 8 lines.\n',
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
      stdout: 't-a  task, open, no check. Brief: 8 lines.\n',
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
      stdout: 't-a  done. Off the brief, kept in the journal. Brief: 6 lines.\n',
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
      stdout: 't-a  dropped. Off the brief, kept in the journal. Brief: 6 lines.\n',
      changed: ['tide-alerts/items.tsv', 'tide-alerts/journal.tsv', 'tide-alerts/session'],
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
        'NOW  none. Run: www now <id> "<next step>"',
        'Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.',
        'Close with www done <id> --evidence "<PR, commit or test run>" or www drop <id> --why "<reason>".',
        'More: www help · www show <id> · www log --since 24h · www decide "<choice>" --why "<reason>"',
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

  expect<unknown>({ ...result, changed: readChangedPaths(before, after) }).toStrictEqual({
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

  await ctx.run(['init', 'alpha', '--goal', `${'g'.repeat(61)}`]);

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
  const shellEnv = { XDG_STATE_HOME: join(ctx.stateRoot, '..') };

  const started = await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], shellEnv);
  const written = await ctx.run(['--session', 'tide-alerts', 'task', 't-a', 'Write it'], shellEnv);

  expect([started.stdout, written.stdout]).toStrictEqual([
    `Started session tide-alerts in ${join(ctx.stateRoot, 'tide-alerts')}. Name it on each command: www --session tide-alerts\n`,
    't-a  task, open, no check. Brief: 8 lines.\n',
  ]);
});

test('it finds the session by WHEREWEREWE_SESSION', async () => {
  const ctx = setupTest();

  const shellEnv = {
    XDG_STATE_HOME: join(ctx.stateRoot, '..'),
    WHEREWEREWE_SESSION: 'tide-alerts',
  };

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const result = await ctx.run(['task', 't-a', 'Write it'], shellEnv);

  expect(result.stdout).toBe('t-a  task, open, no check. Brief: 8 lines.\n');
});

test('it replaces an open item of the same kind in place, keeping its row and replacing its check', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'First claim', '--pid', '5']);
  await ctx.run(['task', 't-b', 'Second claim']);
  await ctx.run(['task', 't-a', 'First claim, written again']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n').slice(3, 7)).toStrictEqual([
    'OPEN (2 of 6)',
    '  t-a         First claim, written again  [no check · 0m]',
    '  t-b         Second claim  [no check · 0m]',
    'Write as you go: one id holds one claim, and www set <id> "<claim>" replaces it.',
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

  expect(brief.stdout.split('\n')[2]).toBe('NOW  none. Run: www now <id> "<next step>"');
});

test('it keeps the item in focus when a different item closes', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-a', 'Write it']);
  await ctx.run(['task', 't-b', 'Write more']);
  await ctx.run(['now', 't-a', 'go']);
  await ctx.run(['drop', 't-b', '--why', 'stopped']);

  const brief = await ctx.run([]);

  expect(brief.stdout.split('\n').slice(2, 4)).toStrictEqual([
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
