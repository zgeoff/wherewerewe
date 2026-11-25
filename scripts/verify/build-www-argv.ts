import { join } from 'node:path';
import { match } from 'ts-pattern';

const cliPath = join(import.meta.dir, '..', '..', 'packages', 'cli', 'src', 'cli.ts');

// The argv that runs the real `www` with HOME, XDG_STATE_HOME and PATH inside the run's folder, the
// agent config folders unset, and only the given host's session variable. It runs in <run>/cwd,
// beside <run>/bin, because a probe skips each PATH entry inside its folder.
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
    ...buildRunFolderStart(stateRoot),
    'env',
    '-u',
    'CLAUDE_CODE_SESSION_ID',
    '-u',
    'CODEX_SESSION_ID',
    '-u',
    'CODEX_THREAD_ID',
    '-u',
    'WHEREWEREWE_SESSION',
    '-u',
    'CLAUDE_CONFIG_DIR',
    '-u',
    'CODEX_HOME',
    ...hostVariables,
    `HOME=${join(stateRoot, 'home')}`,
    `XDG_STATE_HOME=${join(stateRoot, 'state')}`,
    `PATH=${join(stateRoot, 'bin')}`,
    process.execPath,
    cliPath,
    ...argv,
  ];
}

// The words that make the folder <run>/cwd and run the rest of the argv in it.
function buildRunFolderStart(stateRoot: string): readonly string[] {
  return ['/bin/sh', '-c', 'mkdir -p "$0" && cd "$0" && exec "$@"', join(stateRoot, 'cwd')];
}
