import { join } from 'node:path';

const cliPath = join(import.meta.dir, '..', '..', 'packages', 'cli', 'src', 'cli.ts');

// The argv that runs the real `www` as a process, with HOME and XDG_STATE_HOME inside the run's
// state folder under .wringer/, so a journey never reads or writes the owner's stores or settings,
// and with the agent's session variables unset, so it never sees the session that runs it.
export function buildWWWArgv(stateRoot: string, argv: readonly string[]): readonly string[] {
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
    `HOME=${join(stateRoot, 'home')}`,
    `XDG_STATE_HOME=${join(stateRoot, 'state')}`,
    'bun',
    cliPath,
    ...argv,
  ];
}
