import { buildWWWArgv } from './build-www-argv.ts';
import { fillRunFolder } from './fill-run-folder.ts';
import { parseWWWLine } from './parse-www-line.ts';
import type { ProcessOutput } from './read-www-output.ts';

// Runs a `www` command line from a journey as the real `www`, with the run's state folder, and
// returns what it exited with and printed. Each `{run}` becomes the state folder after the line is
// split into words, so a folder with a space in its path stays one word.
export async function runWWWLine(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
  line: string,
  host?: 'claude' | 'codex',
): Promise<ProcessOutput> {
  const output = await exec(
    buildWWWArgv(
      stateRoot,
      parseWWWLine(line).map((word) => fillRunFolder(word, stateRoot)),
      host,
    ),
  );

  return { exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr };
}
