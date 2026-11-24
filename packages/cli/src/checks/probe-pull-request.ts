import { match } from 'ts-pattern';
import { checkLimits } from './check-limits.ts';
import { ghFailures } from './gh-failures.ts';
import type { CheckProbe, CommandResult, RunProbeCommand } from './types.ts';

interface PullRequestTarget {
  readonly repo: string;
  readonly number: string;
}

// gh pr view <n> -R <repo> --json state,statusCheckRollup, read-only.
export async function probePullRequest(
  target: PullRequestTarget,
  run: RunProbeCommand,
): Promise<CheckProbe> {
  const command = await run(
    ['gh', 'pr', 'view', target.number, '-R', target.repo, '--json', 'state,statusCheckRollup'],
    checkLimits.probeTimeoutMs.pr,
  );

  return match(command)
    .with({ kind: 'missing' }, (): CheckProbe => unchecked('gh missing'))
    .with({ kind: 'timeout' }, (): CheckProbe => unchecked('timeout'))
    .with({ kind: 'exit' }, (exit) => readExit(exit))
    .exhaustive();
}

function unchecked(reason: 'gh missing' | 'timeout' | 'offline' | 'gh not logged in'): CheckProbe {
  return { result: { kind: 'unchecked', reason }, failing: [] };
}

function readExit(exit: Extract<CommandResult, { kind: 'exit' }>): CheckProbe {
  if (exit.code !== 0) {
    return readFailure(exit.stderr);
  }

  const parsed = parseView(exit.stdout);

  if (parsed === null) {
    return unchecked(ghFailures.offlineReason);
  }

  if (parsed.state !== 'OPEN') {
    return { result: { kind: 'result', result: parsed.state }, failing: [] };
  }

  const failing = parsed.entries.filter((entry) => entry.isFailing).map((entry) => entry.name);

  const result = match(parsed.entries)
    .when(
      () => failing.length > 0,
      () => 'OPEN failing',
    )
    .when(
      (entries) => entries.some((entry) => entry.isPending),
      () => 'OPEN pending',
    )
    .when(
      (entries) => entries.length === 0,
      () => 'OPEN no checks',
    )
    .otherwise(() => 'OPEN passing');

  return { result: { kind: 'result', result }, failing };
}

function readFailure(stderr: string): CheckProbe {
  if (ghFailures.notFoundTexts.some((text) => stderr.includes(text))) {
    return { result: { kind: 'result', result: 'not found' }, failing: [] };
  }

  if (ghFailures.notLoggedInTexts.some((text) => stderr.includes(text))) {
    return unchecked(ghFailures.notLoggedInReason);
  }

  return unchecked(ghFailures.offlineReason);
}

interface RollupEntry {
  readonly name: string;
  readonly isFailing: boolean;
  readonly isPending: boolean;
}

interface PullRequestView {
  readonly state: 'OPEN' | 'MERGED' | 'CLOSED';
  readonly entries: readonly RollupEntry[];
}

function parseView(text: string): PullRequestView | null {
  let value: unknown = null;

  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const state = value['state'];
  const rollup = value['statusCheckRollup'];

  if (state !== 'OPEN' && state !== 'MERGED' && state !== 'CLOSED') {
    return null;
  }

  return {
    state,
    entries: Array.isArray(rollup) ? rollup.flatMap((entry: unknown) => toEntries(entry)) : [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const failedConclusions: ReadonlySet<string> = new Set([
  'FAILURE',
  'CANCELLED',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'STARTUP_FAILURE',
]);

function toEntries(entry: unknown): RollupEntry[] {
  if (!isRecord(entry)) {
    return [];
  }

  const state = entry['state'];

  // a status context
  if (typeof state === 'string') {
    return [
      {
        name: toName(entry['context']),
        isFailing: state === 'FAILURE' || state === 'ERROR',
        isPending: state === 'PENDING' || state === 'EXPECTED',
      },
    ];
  }

  const conclusion = entry['conclusion'];

  return [
    {
      name: toName(entry['name']),
      isFailing: typeof conclusion === 'string' && failedConclusions.has(conclusion),
      isPending: entry['status'] !== 'COMPLETED',
    },
  ];
}

function toName(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
