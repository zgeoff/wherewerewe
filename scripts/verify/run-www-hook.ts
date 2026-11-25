import { buildWWWArgv } from './build-www-argv.ts';
import { fillRunFolder } from './fill-run-folder.ts';
import type { ProcessOutput } from './read-www-output.ts';

// Pipes a hook payload into the real `www hook <harness>` with the run's home and state folders.
// `{run}` becomes the state folder. `exec` takes no stdin, so a shell passes the payload.
export async function runWWWHook(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
  harness: 'claude' | 'codex',
  payload: string,
): Promise<ProcessOutput> {
  const output = await exec([
    'sh',
    '-c',
    String.raw`payload=$1; shift; printf '%s' "$payload" | "$@"`,
    'sh',
    fillRunFolder(payload, stateRoot),
    ...buildWWWArgv(stateRoot, ['hook', harness], harness),
  ]);

  return { exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr };
}
