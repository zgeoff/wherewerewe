import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { helpText } from '../args/help-text.ts';
import { listCommandShapes, parseCLIArgs } from '../args/parse-cli-args.ts';
import { runCLI } from '../run-cli.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildUsageRunArgv } from '../test-utils/build-usage-run-argv.ts';
import { parseRunLine } from '../test-utils/parse-run-line.ts';
import { readHelpCommandLine } from '../test-utils/read-help-command-line.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('argv-refusal').path;
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };
  const agentEnv = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };

  return {
    stateRoot: join(root, 'wherewerewe'),
    agentEnv,
    ownerEnv: { HOME: root, XDG_STATE_HOME: root },
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
  };
}

test.each([
  {
    command: 'init',
    argv: ['init', 'tide-alerts', '--on', 'x'],
    takes: '--goal',
    setup: [],
    fills: { '<name>': 'tide-alerts', '<goal>': 'Ship it' },
  },
  {
    command: 'import',
    argv: ['import', 'old-notes', '--on', 'x'],
    takes: '--may, --not, --never, --scope, --where, --reading and --drop',
    format1: 'old-notes',
    files: [
      {
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    setup: [],
    fills: { '<name>': 'old-notes' },
  },
  {
    command: 'grant',
    argv: ['grant', '--on', 'x'],
    takes: '--may, --not, --never, --scope, --where and --reading',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    keeps: ['--may'],
    fills: {
      '<words>': 'merge the alert PRs',
      '<where>': 'chat',
      '<what they cover; what the owner kept back>': 'covers merges',
    },
  },
  {
    command: 'now',
    argv: ['now', 't-a', 'Go on', '--who', 'x'],
    takes: '--note and --owed',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write the parser'],
    ],
    fills: { '<id>': 't-a', '<next step>': 'Run the parser tests' },
  },
  {
    command: 'task',
    argv: ['task', 't-b', 'Write more', '--on', 'x'],
    takes: '--pr, --branch, --path, --pid, --note, --owed and --blocked-by',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: { '<id>': 't-b', '<claim>': 'Write more' },
  },
  {
    command: 'wait',
    argv: ['wait', 'x', 'y', '--on', 'y'],
    takes: '--pr, --branch, --path, --pid, --note, --owed and --who',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: { '<id>': 'w-a', '<what>': 'The staging key', '<who>': 'owner' },
  },
  {
    command: 'rule',
    argv: ['rule', 'r-a', 'Keep it small', '--on', 'x'],
    takes: '--note and --owed',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: { '<id>': 'r-a', '<do it this way, and why>': 'Keep it small: reviews stay short' },
  },
  {
    command: 'where',
    argv: ['where', 'wt-a', 'The docks', '--on', 'x'],
    takes: '--pr, --branch, --path, --pid, --note and --owed',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: { '<id>': 'wt-a', '<what and where, and how to stop it>': 'The docks folder' },
  },
  {
    command: 'set',
    argv: ['set', 't-a', 'Write again', '--on', 'x'],
    takes: '--pr, --branch, --path, --pid, --note, --owed and --no-note',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write the parser'],
    ],
    keeps: ['<claim>'],
    fills: { '<id>': 't-a', '<claim>': 'Write it again' },
  },
  {
    command: 'done',
    argv: ['done', 't-a', '--why', 'x'],
    takes: '--evidence',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write the parser'],
    ],
    fills: { '<id>': 't-a', '<PR, commit or test run>': 'the merged PR' },
  },
  {
    command: 'drop',
    argv: ['drop', 't-a', '--evidence', 'x'],
    takes: '--why',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write the parser'],
    ],
    fills: { '<id>': 't-a', '<reason>': 'The work moved' },
  },
  {
    command: 'ok',
    argv: ['ok', 'ok-a', '--on', 'x'],
    takes: '--quote, --who, --where, --scope, --once, --note and --owed',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: {
      '<id>': 'ok-a',
      '<their exact words>': 'merge it yourself',
      '<who>': 'owner',
      '<where>': 'chat',
      '<scope>': 'the alert PRs',
    },
  },
  {
    command: 'use',
    argv: ['use', 'ok-a', '--why', 'x'],
    takes: '--for',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'ok',
        'ok-a',
        '--quote',
        'merge it yourself',
        '--who',
        'owner',
        '--where',
        'chat',
        '--scope',
        'the alert PRs',
      ],
    ],
    fills: { '<id>': 'ok-a', '<what you did with it>': 'merged it' },
  },
  {
    command: 'decide',
    argv: ['decide', 'Retry a 503', '--evidence', 'x'],
    takes: '--why, --on, --who, --ruled-out and --replaces',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: { '<choice>': 'Retry a 503 3 times', '<reason>': 'The feed flaps' },
  },
  {
    command: 'say',
    argv: ['--session', 'tide-alerts', 'say', 'Ask me first', '--why', 'x'],
    takes: '--on',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    owner: true,
    scope: 'www --session tide-alerts ',
    fills: { '<text>': 'Ask me first' },
  },
  {
    command: 'log',
    argv: ['log', '--on', 'x'],
    takes: '--since, --op and --id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: {},
  },
  {
    command: 'recap',
    argv: ['recap', '--op', 'x'],
    takes: '--since',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    fills: {},
  },
] as const)(
  'it names the flags of $command in the refusal of a flag it does not take',
  async (row) => {
    const ctx = setupTest();
    const env = 'owner' in row ? ctx.ownerEnv : ctx.agentEnv;
    const terminal = { stdin: 'owner' in row, stdout: 'owner' in row };

    if ('format1' in row) {
      seedFormat1Store(ctx.stateRoot, row.format1);
    }

    for (const file of 'files' in row ? row.files : []) {
      seedStoreFile(join(ctx.stateRoot, 'old-notes'), file.name, file.text);
    }

    for (const setupArgv of row.setup) {
      await ctx.run(setupArgv);
    }

    const line = readHelpCommandLine(helpText, row.command);

    const refused = await ctx.run(row.argv, env, terminal);

    const runLine = refused.stderr.split('\n').find((text) => text.startsWith('Run: www'));
    const keeps = 'keeps' in row ? row.keeps : [];

    const filled = await ctx.run(buildUsageRunArgv(runLine ?? '', row.fills, keeps), env, terminal);

    const flag = row.argv.findLast((word) => word.startsWith('--')) ?? '';

    expect({ refused, filledExitCode: filled.exitCode }).toStrictEqual({
      refused: {
        exitCode: 2,
        stdout: '',
        stderr: `www: ${row.command} takes no ${flag} flag. It takes ${row.takes}.\nRun: ${'scope' in row ? row.scope : 'www '}${line}\n`,
      },
      filledExitCode: 0,
    });
  },
);

test.each([['-h'], ['--help']])(
  'it refuses a flag help does not take with help in its text, for %s',
  async (flag) => {
    const ctx = setupTest();

    const refused = await ctx.run([flag, '--bogus=y']);

    expect(refused).toStrictEqual({
      exitCode: 2,
      stdout: '',
      stderr: 'www: help takes no --bogus flag. It takes only --session.\nRun: www help\n',
    });
  },
);

test('it keeps --session on the usage Run line of a flag the command does not take', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run(['wait', 'w-a', 'x', '--session', 'tide-alerts', '--on', 'y']);

  const runLine = refused.stderr.split('\n').find((text) => text.startsWith('Run: www'));

  const filled = await ctx.run(
    buildUsageRunArgv(runLine ?? '', {
      '<id>': 'w-a',
      '<what>': 'The staging key',
      '<who>': 'owner',
    }),
  );

  expect({ stderr: refused.stderr, filledExitCode: filled.exitCode }).toStrictEqual({
    stderr:
      'www: wait takes no --on flag. It takes --pr, --branch, --path, --pid, --note, --owed and --who.\nRun: www --session tide-alerts wait <id> "<what>" --who <who> [<check>]\n',
    filledExitCode: 0,
  });
});

test.each(
  listCommandShapes().flatMap((shape) =>
    [
      '--bogus',
      ['--goal', '--on', '--why'].find((flag) => !shape.taken.includes(flag.slice(2))),
    ].map((flag) => ({
      command: shape.command,
      taken: shape.taken,
      flag: flag ?? '',
      argv: [...(shape.command === 'brief' ? [] : [shape.command]), `${flag ?? ''}=y`],
      helpLine: shape.command === 'brief' ? '' : readHelpCommandLine(helpText, shape.command),
    })),
  ),
)('it names the flags of $command and its help line in the refusal of $flag', async (row) => {
  const ctx = setupTest();

  const refused = await ctx.run(row.argv);

  const runLine = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const fills = Object.fromEntries(
    parseRunLine(runLine)
      .map((word) => word.replaceAll(/^\[+|\]+$/gu, ''))
      .filter((word) => /<[^>|]*>/u.test(word))
      .map((word) => [word, 'zz-a']),
  );

  const named = row.command === 'brief' ? 'the brief' : row.command;
  const flags = row.taken.map((flag) => `--${flag}`);

  const takes =
    flags.length === 0
      ? 'only --session'
      : [flags.slice(0, -1).join(', '), flags.at(-1)].filter((part) => part !== '').join(' and ');

  expect({
    refused,
    filled: parseCLIArgs(buildUsageRunArgv(runLine, fills)).kind,
  }).toStrictEqual({
    refused: {
      exitCode: 2,
      stdout: '',
      stderr: `www: ${named} takes no ${row.flag} flag. It takes ${takes}.\nRun: ${['www', row.helpLine ?? row.command].filter((part) => part !== '').join(' ')}\n`,
    },
    filled: 'args',
  });
});

test.each(buildCredentialSamples().map((entry) => [entry.name, entry.sample, entry.tail] as const))(
  'it prints a %s sample typed as a flag as the placeholder, with none of its tail',
  async (_name, sample, tail) => {
    const ctx = setupTest();

    const refused = await ctx.run(['goal', 'x', `--${sample}`]);

    const [first] = refused.stderr.split('\n');

    expect({ first, leaked: refused.stderr.includes(tail) }).toStrictEqual({
      first: 'www: goal takes no <where the secret lives> flag. It takes only --session.',
      leaked: false,
    });
  },
);
