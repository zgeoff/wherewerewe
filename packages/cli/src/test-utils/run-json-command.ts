import { runCLI } from '../run-cli.ts';

// Runs a read command with --json at 2026-03-10T11:43:00Z, as an agent outside a terminal, and
// returns its exit code, the number of lines it printed, and the JSON it printed, parsed.
export async function runJsonCommand(
  env: Readonly<Record<string, string | undefined>>,
  argv: readonly string[],
): Promise<{ readonly exitCode: number; readonly lines: number; readonly value: unknown }> {
  const result = await runCLI({
    argv: [...argv, '--json'],
    env,
    cwd: '/work',
    terminal: { stdin: false, stdout: false },
    now: () => Date.parse('2026-03-10T11:43:00Z'),
  });

  return {
    exitCode: result.exitCode,
    lines: result.stdout.split('\n').length - 1,
    value: result.stdout === '' ? null : JSON.parse(result.stdout),
  };
}
