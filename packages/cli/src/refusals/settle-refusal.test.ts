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
    }).toStrictEqual({
      runLines: isWritten ? 0 : 1,
      retries: isWritten ? [] : [0],
      credential: false,
    });
  },
);

test('it ends at www help after three refusals in a row', () => {
  const settled = settleRefusal(
    { exitCode: 2, lines: ['www: x'], runs: [{ www: ['goal', 'a', 'b'] }] },
    { sessionFlag: null, typedWords: [] },
  );

  expect(settled).toStrictEqual({
    exitCode: 2,
    lines: ['www: goal takes "<what done means>".'],
    runs: [{ www: ['help'] }],
  });
});
