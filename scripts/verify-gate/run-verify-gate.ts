import { join } from 'node:path';
import { match } from 'ts-pattern';
import { pickGateStep } from './pick-gate-step.ts';

type RunCommand = (argv: readonly string[]) => Promise<number>;

export interface RunVerifyGateOptions {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runCommand: RunCommand;
}

// The `verify / gate` step. It reads the body from the event file, as GitHub wrote it when the run
// started, so an `edited` run reads the report that `bun verify publish` just wrote.
export async function runVerifyGate(options: RunVerifyGateOptions) {
  const eventPath = options.env['GITHUB_EVENT_PATH'];
  const tempDirectory = options.env['RUNNER_TEMP'];

  if (eventPath === undefined || tempDirectory === undefined) {
    process.stderr.write(
      '::error::set GITHUB_EVENT_PATH and RUNNER_TEMP; a pull_request run sets both\n',
    );

    return 1;
  }

  const eventText = await Bun.file(eventPath).text();

  const event: unknown = JSON.parse(eventText);

  return match(pickGateStep(event))
    .with({ kind: 'refused' }, (refused) => {
      process.stderr.write(`::error::${refused.message}\n`);

      return 1;
    })
    .with({ kind: 'skip' }, (skip) => {
      process.stdout.write(`verify gate skipped: ${skip.reason}\n`);

      return 0;
    })
    .with({ kind: 'gate' }, async (gate) => {
      const bodyFile = join(tempDirectory, 'pr-body.md');

      await Bun.write(bodyFile, gate.body);

      return options.runCommand([
        'bun',
        'verify',
        'gate',
        '--base',
        `origin/${gate.baseRef}`,
        '--body-file',
        bodyFile,
      ]);
    })
    .exhaustive();
}

if (import.meta.main) {
  process.exitCode = await runVerifyGate({
    env: process.env,
    runCommand: (argv) => Bun.spawn([...argv], { stdout: 'inherit', stderr: 'inherit' }).exited,
  });
}
