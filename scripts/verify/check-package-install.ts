import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WringerError } from '@wringer/core';
import type { ProcessOutput } from './read-www-output.ts';

export interface PackageInstallRun {
  readonly stateRoot: string;
  readonly target: string;
  readonly version: string;
}

// Fails the step with `check-failed` unless install.sh exited 0, printed nothing on stderr, and
// printed exactly its download, installed and PATH lines for the run's folders and this version;
// the run's bin folder is never on PATH, so the PATH line always prints.
export function checkPackageInstall(result: ProcessOutput, run: PackageInstallRun): ProcessOutput {
  const release = pathToFileURL(join(run.stateRoot, 'release')).href;
  const bin = join(run.stateRoot, 'bin');

  const expected = [
    `wherewerewe: downloading ${release}/wherewerewe-${run.target}`,
    `wherewerewe: installed wherewerewe ${run.version} to ${bin}/wherewerewe`,
    `wherewerewe: add ${bin} to your PATH`,
    '',
  ].join('\n');

  if (result.exitCode !== 0 || result.stdout !== expected || result.stderr !== '') {
    throw new WringerError('check-failed', {
      message: `install.sh exited ${String(result.exitCode)} and printed ${JSON.stringify(result.stdout + result.stderr)}, not ${JSON.stringify(expected)}`,
    });
  }

  return result;
}
