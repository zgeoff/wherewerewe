import { join } from 'node:path';
import { cliPath } from './build-www-argv.ts';

// The argv of a terminal program: the real www in the run's folder, with the five agent variables
// and WHEREWEREWE_SESSION unset. The driver adds a program's env to the supervisor's, so only env -u
// clears them. `set` sets variables back, for the program that plays an agent.
export function buildTerminalWWWArgv(
  stateRoot: string,
  argv: readonly string[],
  set: Readonly<Record<string, string>>,
): readonly string[] {
  return [
    'env',
    '-u',
    'CLAUDECODE',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'CODEX_CI',
    '-u',
    'WHEREWEREWE_SESSION',
    ...Object.entries(set).map(([name, value]) => `${name}=${value}`),
    `HOME=${join(stateRoot, 'home')}`,
    `XDG_STATE_HOME=${join(stateRoot, 'state')}`,
    `PATH=${join(stateRoot, 'bin')}`,
    process.execPath,
    cliPath,
    ...argv,
  ];
}
