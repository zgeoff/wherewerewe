import type { Item, PullRequestRow } from '../types.ts';
import { checkLimits } from './check-limits.ts';
import { parseCheckTarget } from './parse-check-target.ts';
import { probeCheck } from './probe-check.ts';
import { createKillSet, runCommand } from './run-command.ts';
import type { KillSet } from './run-command.ts';
import type { CheckRun, ProbeResult, StatPath, UncheckedReason } from './types.ts';

export interface RunChecksOptions {
  readonly deadlineMs: number;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly now: () => number;
  readonly statPath?: StatPath;
}

// A probe the deadline stops reads unchecked with the reason timeout. The deadline is checked
// before every command starts, against its time as well as the timer: a stat that holds the event
// loop past it resolves before the timer runs, and must start no git.
export async function runChecks(
  order: readonly string[],
  items: readonly Item[],
  prs: readonly PullRequestRow[],
  options: RunChecksOptions,
): Promise<CheckRun> {
  const kills = createKillSet();
  const queue = { isStopped: false, next: 0, deadlineAtMs: performance.now() + options.deadlineMs };

  const isStopped = (): boolean => {
    queue.isStopped ||= performance.now() >= queue.deadlineAtMs;

    return queue.isStopped;
  };

  const jobs = buildJobs({
    order,
    items,
    prs,
    env: options.env,
    kills,
    statPath: options.statPath,
    isStopped,
  });

  if (jobs.length === 0) {
    return { results: new Map(), ran: 0, unchecked: 0, reason: null, elapsedMs: 0 };
  }

  const startMs = options.now();

  const found = new Map<string, ProbeResult>();

  const work = async (): Promise<void> => {
    while (!isStopped() && queue.next < jobs.length) {
      const job = jobs[queue.next];

      queue.next += 1;

      if (job !== undefined) {
        const result = await job.run();

        if (!isStopped()) {
          found.set(job.key, result);
        }
      }
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  const deadline = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      queue.isStopped = true;

      resolve();
    }, options.deadlineMs);
  });

  await Promise.race([
    Promise.all(Array.from({ length: checkLimits.maxParallelProbes }, () => work())),
    deadline,
  ]);

  clearTimeout(timer);

  queue.isStopped = true;

  kills.killAll();

  const timedOut: ProbeResult = { kind: 'unchecked', reason: 'timeout' };
  const all = jobs.map((job) => [job.key, found.get(job.key) ?? timedOut] as const);

  const unchecked = all.flatMap(([, result]) =>
    result.kind === 'unchecked' ? [result.reason] : [],
  );

  return {
    results: new Map(
      all.map(([key, result]) => [key, result.kind === 'result' ? result.result : 'unchecked']),
    ),
    ran: jobs.length,
    unchecked: unchecked.length,
    reason: pickReason(unchecked),
    elapsedMs: options.now() - startMs,
  };
}

interface ProbeJob {
  readonly key: string;
  readonly run: () => Promise<ProbeResult>;
}

interface JobsInput {
  readonly order: readonly string[];
  readonly items: readonly Item[];
  readonly prs: readonly PullRequestRow[];
  readonly env: RunChecksOptions['env'];
  readonly kills: KillSet;
  readonly statPath: StatPath | undefined;
  readonly isStopped: () => boolean;
}

function buildJobs(input: JobsInput): ProbeJob[] {
  const named = new Set(input.items.flatMap((item) => (item.check === null ? [] : [item.check])));

  const isProbedRow = (row: PullRequestRow): boolean =>
    row.state !== 'MERGED' && row.state !== 'CLOSED' && !named.has(`pr:${row.ref}`);

  const keys = [
    ...input.order,
    ...input.items.filter((item) => item.check !== null).map((item) => item.id),
    ...input.prs.filter((row) => isProbedRow(row)).map((row) => row.ref),
  ].filter((key, index, all) => all.indexOf(key) === index);

  const jobs: ProbeJob[] = [];

  for (const key of keys) {
    const item = input.items.find((candidate) => candidate.id === key);
    const row = input.prs.find((candidate) => candidate.ref === key);
    const ref = item?.check ?? (row !== undefined && isProbedRow(row) ? `pr:${row.ref}` : null);
    const target = ref === null ? null : parseCheckTarget(ref);

    if (target !== null) {
      jobs.push({
        key,
        run: async () => {
          const probe = await probeCheck(target, {
            extra: item?.extra ?? {},
            ...(input.statPath === undefined ? {} : { statPath: input.statPath }),
            run: (argv, timeoutMs) =>
              input.isStopped()
                ? Promise.resolve({ kind: 'timeout' })
                : runCommand(argv, { env: input.env, timeoutMs, kills: input.kills }),
          });

          return probe.result;
        },
      });
    }
  }

  return jobs;
}

function pickReason(reasons: readonly UncheckedReason[]): UncheckedReason | 'mixed' | null {
  const [first] = reasons;

  if (first === undefined) {
    return null;
  }

  return reasons.every((reason) => reason === first) ? first : 'mixed';
}
