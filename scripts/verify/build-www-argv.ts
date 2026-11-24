import { join } from 'node:path';
import { match } from 'ts-pattern';

export const cliPath = join(import.meta.dir, '..', '..', 'packages', 'cli', 'src', 'cli.ts');

// The argv that runs the real `www` as a process, with HOME and XDG_STATE_HOME inside the run's
// state folder under .wringer/ and the agent's session variables unset, so a journey never touches
// the owner's stores. A host then sets its session variable, so the brief takes that host's budget.
export function buildWWWArgv(
  stateRoot: string,
  argv: readonly string[],
  host?: 'claude' | 'codex',
): readonly string[] {
  const hostVariables = match(host)
    .with(undefined, () => [])
    .with('claude', () => ['CLAUDE_CODE_SESSION_ID=verify-host'])
    .with('codex', () => ['CODEX_SESSION_ID=verify-host'])
    .exhaustive();

  return [
    'env',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'WHEREWEREWE_SESSION',
    ...hostVariables,
    `HOME=${join(stateRoot, 'home')}`,
    `XDG_STATE_HOME=${join(stateRoot, 'state')}`,
    'bun',
    cliPath,
    ...argv,
  ];
}
