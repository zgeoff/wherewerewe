import { match } from 'ts-pattern';
import { probeBranch } from './probe-branch.ts';
import { probePath } from './probe-path.ts';
import { probeProcess } from './probe-process.ts';
import { probePullRequest } from './probe-pull-request.ts';
import type { CheckProbe, CheckTarget, ProbeContext } from './types.ts';

// Runs the probe of one stored check. It only reads.
export function probeCheck(target: CheckTarget, context: ProbeContext): Promise<CheckProbe> {
  return match(target)
    .with({ kind: 'pr' }, (pr) => probePullRequest(pr, context.run))
    .with({ kind: 'branch' }, (branch) => probeBranch(branch, context.run))
    .with({ kind: 'path' }, (path) => probePath(path, context.run, context.statPath))
    .with({ kind: 'pid' }, (pid) => Promise.resolve(probeProcess(pid, context.extra)))
    .exhaustive();
}
