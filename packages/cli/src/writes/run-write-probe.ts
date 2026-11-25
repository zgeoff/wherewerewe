import { match } from 'ts-pattern';
import { parseCheckTarget } from '../checks/parse-check-target.ts';
import { probeCheck } from '../checks/probe-check.ts';
import { createKillSet, runCommand } from '../checks/run-command.ts';
import { readProcess } from '../store/read-process.ts';
import { readStore } from '../store/read-store.ts';
import type { ParsedArgs } from '../types.ts';
import { pickWriteCheck } from './pick-item-write.ts';
import type { WriteProbe } from './types.ts';

interface WriteProbeInput {
  readonly folder: string;
  readonly args: ParsedArgs;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
}

// Runs the probe of the check a write will store. It reads the store without the lock, because a
// pull request probe can take longer than another writer waits for the lock. The write applies the
// result only when the item still names that check.
export async function runWriteProbe(input: WriteProbeInput): Promise<WriteProbe | null> {
  const read = await readStore(input.folder);

  if (read.kind !== 'store') {
    return null;
  }

  const ref = pickWriteCheck(input.args, read.store, input.cwd);
  const target = ref === null ? null : parseCheckTarget(ref);

  if (ref === null || target === null) {
    return null;
  }

  const kills = createKillSet();

  const probe = await probeCheck(target, {
    extra: {},
    run: (argv, timeoutMs) =>
      runCommand(argv, { env: input.env, cwd: input.cwd, timeoutMs, kills }),
  });

  return {
    ref,
    result: probe.result.kind === 'result' ? probe.result.result : 'unchecked',
    pidStart: match(target)
      .with({ kind: 'pid' }, (pid) => {
        const state = readProcess(pid.pid);

        return state.kind === 'running' ? state.start : null;
      })
      .otherwise(() => null),
  };
}
