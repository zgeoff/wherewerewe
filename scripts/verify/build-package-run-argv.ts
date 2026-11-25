import { join } from 'node:path';

// The argv that runs an installed binary by name, with HOME and XDG_STATE_HOME inside the run, the
// agent's session variables unset, and the run's bin folder as PATH, so the two names resolve as a
// user's shell would find them.
export function buildPackageRunArgv(
  stateRoot: string,
  name: string,
  words: readonly string[],
): readonly string[] {
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
    `PATH=${join(stateRoot, 'bin')}`,
    join(stateRoot, 'bin', name),
    ...words,
  ];
}
