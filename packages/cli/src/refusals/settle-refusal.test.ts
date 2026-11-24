import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
import { buildGrantFaultCases, faultCredential } from '../test-utils/build-grant-fault-cases.ts';
import { parseRunLine } from '../test-utils/parse-run-line.ts';
import { settleRefusal } from './settle-refusal.ts';

function setupTest() {
  const root = createTempDir('settle-refusal').path;
  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };

  return {
    run: (argv: readonly string[]) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => Date.parse('2026-03-10T11:43:00Z'),
      }),

    // every placeholder filled with one short word, so a filled grant stays within its limits
    fill: (line: string) =>
      buildFilledRunArgv(
        line,
        Object.fromEntries(
          parseRunLine(line).flatMap((word) => (/<[^<>]+>/u.test(word) ? [[word, 'x']] : [])),
        ),
      ),
  };
}

test.each(buildGrantFaultCases().map((entry) => [entry.title, entry.argv] as const))(
  'it prints Run lines that pass once filled, for %s',
  async (_title, argv) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const refused = await ctx.run(argv);

    const runLines = refused.stderr.split('\n').filter((line) => line.startsWith('Run: www'));

    const retries = await Promise.all(
      runLines.map(async (line) => {
        const retried = await ctx.run(ctx.fill(line));

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

test.each(
  ['log', 'recap'].flatMap((command) =>
    [[], ['--session', 'tide-alerts']].flatMap((session) =>
      [
        ['--since', '-2h'],
        ['--since=-2h'],
        ['--since', 'soon'],
        ['--since'],
        ['extra'],
        ['--since', faultCredential],
        [`--since=${faultCredential}`],
        ...(command === 'recap' ? [['--op', 'decide']] : []),
      ].map((flags) => ({ command, argv: [command, ...session, ...flags] })),
    ),
  ),
)('it prints one Run line for $argv that passes once filled', async (row) => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run(row.argv);

  const runLines = refused.stderr.split('\n').filter((line) => line.startsWith('Run: www'));

  const retries = await Promise.all(
    runLines.map(async (line) => {
      const retried = await ctx.run(ctx.fill(line));

      return retried.exitCode;
    }),
  );

  expect({
    isRefused: refused.exitCode !== 0,
    runLines: runLines.length,
    retries,
    credential: refused.stderr.includes(faultCredential),
  }).toStrictEqual({ isRefused: true, runLines: 1, retries: [0], credential: false });
});

test('it ends at www help after three refusals in a row', () => {
  const settled = settleRefusal(
    { exitCode: 2, lines: ['www: x'], runs: [{ www: ['goal', 'a', 'b'] }] },
    { sessionFlag: null },
  );

  expect(settled).toStrictEqual({
    refusal: {
      exitCode: 2,
      lines: ['www: goal takes "<what done means>".'],
      runs: [{ www: ['help'] }],
    },
    scope: { sessionFlag: null },
  });
});

test.each([
  {
    title: 'a typed circled digit beside a credential in another flag',
    argv: [
      'grant',
      '--may',
      '①',
      '--where',
      'chat',
      '--reading',
      '-',
      '--never',
      '-keep',
      '--not',
      faultCredential,
    ],
    exitCode: 3,
    stderr:
      'www: refused: the reading is empty.\nRun: www grant --may ① --where chat --reading "<reading>" --never="-keep" --not "<where the secret lives>"\n',
  },
  {
    title: 'a typed value that reads like a placeholder and holds a bullet mark',
    argv: [
      'grant',
      '--may',
      'water',
      '--where',
      '<chat • log>',
      '--reading',
      'works',
      '--never',
      '-keep',
    ],
    exitCode: 3,
    stderr:
      'www: refused: the where cannot hold •, which the brief prints before each bullet.\nRun: www grant --may water --where "<chat - log>" --reading works --never="-keep"\n',
  },
  {
    title: 'a --session value that starts with a dash',
    argv: ['--session=--help', 'grant', 'extra'],
    exitCode: 2,
    stderr: 'www: grant takes no arguments.\nRun: www help\n',
  },
  {
    title: 'a joined flag with a credential after --',
    argv: ['task', '--note', '-keep', '--', 't-a', `--may=${faultCredential}`],
    exitCode: 2,
    stderr:
      'www: the value of --note starts with a dash, so it reads as a flag. Join the two with =, as in --note="<value>".\nRun: www task --note="-keep" -- t-a "<where the secret lives>"\n',
  },
])(
  'it prints a Run line that keeps each typed value and passes once filled, for $title',
  async (row) => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

    const refused = await ctx.run(row.argv);

    const runLine = refused.stderr.split('\n').find((line) => line.startsWith('Run: www')) ?? '';

    const retried = await ctx.run(ctx.fill(runLine));

    expect({
      exitCode: refused.exitCode,
      stderr: refused.stderr,
      retried: retried.exitCode,
    }).toStrictEqual({ exitCode: row.exitCode, stderr: row.stderr, retried: 0 });
  },
);
