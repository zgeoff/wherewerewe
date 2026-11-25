import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWWWArgv } from './build-www-argv.ts';
import { makeProbeBin } from './make-probe-bin.ts';
import type { ProcessOutput } from './read-www-output.ts';

// Runs `www install` against the run's own home, with a stub `wherewerewe` in the run's bin folder.
// The run folder sits under the repo, and install ignores a PATH folder under its working folder,
// so a shell runs it from the run's home folder. The stub is no script and is never run.
export function runWWWInstall(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
): Promise<ProcessOutput> {
  const bin = makeProbeBin(stateRoot);
  const home = join(stateRoot, 'home');

  writeFileSync(join(bin, 'wherewerewe'), 'binary-stub');
  chmodSync(join(bin, 'wherewerewe'), 0o755);
  mkdirSync(home, { recursive: true });

  return exec([
    'sh',
    '-c',
    String.raw`cd "$1" && shift && exec "$@"`,
    'sh',
    home,
    ...buildWWWArgv(stateRoot, ['install']),
  ]);
}
