import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWWWArgv } from './build-www-argv.ts';
import { makeProbeBin } from './make-probe-bin.ts';
import type { ProcessOutput } from './read-www-output.ts';

// Runs `www install` against the run's own home, with a stub `wherewerewe` and a stub `git` that
// prints a version, so the machine's git never runs. The run folder sits under the repo, and install
// ignores a PATH folder under its working folder, so a shell runs it from the run's home folder.
export function runWWWInstall(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
): Promise<ProcessOutput> {
  const bin = makeProbeBin(stateRoot);
  const home = join(stateRoot, 'home');

  writeFileSync(join(bin, 'wherewerewe'), 'binary-stub');
  chmodSync(join(bin, 'wherewerewe'), 0o755);
  rmSync(join(bin, 'git'), { force: true });
  writeFileSync(join(bin, 'git'), '#!/bin/sh\necho "git version 2.50.0"\n');
  chmodSync(join(bin, 'git'), 0o755);
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
