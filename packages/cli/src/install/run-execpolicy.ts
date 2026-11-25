// Runs `codex execpolicy check` for the command `www` against one rules file, from the root folder
// so no project config applies, with no stdin and a time limit, and returns what it printed. `null` when it fails to start, fails to run or exits
// non-zero.
export function runExecpolicy(
  codex: string,
  rulesPath: string,
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  try {
    const result = Bun.spawnSync(
      [codex, 'execpolicy', 'check', '--rules', rulesPath, '--', 'www'],
      {
        env: { ...env },
        cwd: '/',
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
      },
    );

    return result.exitCode === 0 ? result.stdout.toString() : null;
  } catch {
    return null;
  }
}
