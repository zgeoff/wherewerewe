import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProcessOutput } from './read-www-output.ts';
import { runWWWLine } from './run-www-line.ts';

// Runs a `www` command line against a copy of the run's state folder and removes the copy, so a
// line that succeeds leaves the run as it was.
export async function runWWWLineOnCopy(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
  line: string,
): Promise<ProcessOutput> {
  const copyRoot = await mkdtemp(join(tmpdir(), 'www-refuse-'));

  try {
    await cp(stateRoot, copyRoot, { recursive: true });

    return await runWWWLine(exec, copyRoot, line);
  } finally {
    await rm(copyRoot, { recursive: true, force: true });
  }
}
