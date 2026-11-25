import { buildWWWArgv } from './build-www-argv.ts';
import { fillRunFolder } from './fill-run-folder.ts';
import { makeProbeBin } from './make-probe-bin.ts';
import type { ProcessOutput } from './read-www-output.ts';
import { runWWWLine } from './run-www-line.ts';

// Pipes a hook payload into the real `www hook <harness>` with the run's home and state folders.
// `{run}` becomes the state folder, and `{brief:<name>}` the whole brief of that session that `www`
// prints for the host, as JSON string text. `exec` takes no stdin, so a shell passes the payload.
export async function runWWWHook(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
  harness: 'claude' | 'codex',
  payload: string,
): Promise<ProcessOutput> {
  makeProbeBin(stateRoot);

  const filled = await fillBrief(exec, stateRoot, harness, fillRunFolder(payload, stateRoot));

  const output = await exec([
    'sh',
    '-c',
    String.raw`payload=$1; shift; printf '%s' "$payload" | "$@"`,
    'sh',
    filled,
    ...buildWWWArgv(stateRoot, ['hook', harness], harness),
  ]);

  return { exitCode: output.exitCode, stdout: output.stdout, stderr: output.stderr };
}

async function fillBrief(
  exec: (argv: readonly string[]) => Promise<ProcessOutput>,
  stateRoot: string,
  harness: 'claude' | 'codex',
  payload: string,
): Promise<string> {
  const token = /\{brief:(?<name>[a-z0-9-]+)\}/u.exec(payload);
  const name = token?.groups?.['name'];

  if (token === null || name === undefined) {
    return payload;
  }

  const brief = await runWWWLine(exec, stateRoot, `www --session ${name}`, harness);

  return payload.replaceAll(token[0], JSON.stringify(brief.stdout).slice(1, -1));
}
