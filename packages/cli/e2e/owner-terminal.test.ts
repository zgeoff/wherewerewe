// Runs the real www under `script`, which gives it a pseudo-terminal on stdin and stdout. This is
// the bypass owner-notes.md says the tool does not stop: a faked terminal with the agent variables
// cleared. Each test runs with HOME and XDG_STATE_HOME inside a temporary folder, after an init.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveProgram } from '@zgeoff/rig/e2e';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { quoteShellWord } from '../src/refusals/quote-shell-word.ts';

async function setupTest() {
  const program = await resolveProgram('www');

  const folder = createTempDir('owner-terminal').path;

  const cleanEnv = {
    HOME: join(folder, 'home'),
    XDG_STATE_HOME: folder,
    CLAUDECODE: '',
    CLAUDE_CODE_SESSION_ID: '',
    CODEX_SESSION_ID: '',
    CODEX_THREAD_ID: '',
    CODEX_CI: '',
    WHEREWEREWE_SESSION: '',
  };

  const buildCommand = (argv: readonly string[]) =>
    [...program.command, ...argv].map((word) => quoteShellWord(word)).join(' ');

  await run(program.command, {
    cwd: program.cwd,
    env: cleanEnv,
    args: ['init', 'tide-alerts', '--goal', 'Ship the glaze timer'],
  });

  return {
    ownerOnlyText:
      'www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait or an approval.\nRun: www --session tide-alerts rule <id> "<what the owner said, as a rule>"\n',
    folder,
    runPiped: (argv: readonly string[], env: Record<string, string> = {}) =>
      run(program.command, { cwd: program.cwd, env: { ...cleanEnv, ...env }, args: argv }),
    runUnderScript: async (
      argv: readonly string[],
      options: { readonly suffix?: string; readonly env?: Record<string, string> } = {},
    ) => {
      const result = await run(
        ['script', '-qec', `${buildCommand(argv)}${options.suffix ?? ''}`, '/dev/null'],
        { cwd: program.cwd, env: { ...cleanEnv, ...options.env } },
      );

      return {
        exitCode: result.exitCode,
        output: result.stdout.replaceAll('\r\n', '\n'),
      };
    },
    readFile: (name: string) => readFileSync(join(folder, name), 'utf8'),
  };
}

test('it writes and clears a note under a terminal with no agent variable', async () => {
  const ctx = await setupTest();
  const say = await ctx.runUnderScript(['--session', 'tide-alerts', 'say', 'Ask me first']);
  const ack = await ctx.runUnderScript(['--session', 'tide-alerts', 'ack', 'o-1']);

  expect({ say, ack }).toStrictEqual({
    say: {
      exitCode: 0,
      output:
        'o-1  owner note. It tops the brief until you run: www --session tide-alerts ack o-1. Brief: 8 lines.\n',
    },
    ack: { exitCode: 0, output: 'o-1  cleared. Kept in the journal. Brief: 6 lines.\n' },
  });
});

test('it refuses say when stdin is not a terminal', async () => {
  const ctx = await setupTest();

  const result = await ctx.runUnderScript(['--session', 'tide-alerts', 'say', 'Ask me first'], {
    suffix: ' < /dev/null',
  });

  expect(result).toStrictEqual({ exitCode: 3, output: ctx.ownerOnlyText });
});

test('it refuses say when stdout is not a terminal, and prints nothing to the file', async () => {
  const ctx = await setupTest();

  const result = await ctx.runUnderScript(['--session', 'tide-alerts', 'say', 'Ask me first'], {
    suffix: ` > ${quoteShellWord(join(ctx.folder, 'stdout.txt'))}`,
  });

  expect({ result, file: ctx.readFile('stdout.txt') }).toStrictEqual({
    result: { exitCode: 3, output: ctx.ownerOnlyText },
    file: '',
  });
});

test.each([
  'CLAUDECODE',
  'CLAUDE_CODE_SESSION_ID',
  'CODEX_SESSION_ID',
  'CODEX_THREAD_ID',
  'CODEX_CI',
])('it refuses say under a terminal when %s is set', async (name) => {
  const ctx = await setupTest();

  const result = await ctx.runUnderScript(['--session', 'tide-alerts', 'say', 'Ask me first'], {
    env: { [name]: '1' },
  });

  expect(result).toStrictEqual({ exitCode: 3, output: ctx.ownerOnlyText });
});

test('it refuses say with piped stdio and no terminal', async () => {
  const ctx = await setupTest();
  const result = await ctx.runPiped(['--session', 'tide-alerts', 'say', 'Ask me first']);

  expect({ exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }).toStrictEqual(
    {
      exitCode: 3,
      stdout: '',
      stderr: ctx.ownerOnlyText,
    },
  );
});
