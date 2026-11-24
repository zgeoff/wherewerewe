import type { Extra } from '../types.ts';

// one of the values in checks.md's table; at most 15 characters
type CheckResult = string;

export type UncheckedReason =
  | 'offline'
  | 'gh missing'
  | 'gh not logged in'
  | 'git missing'
  | 'timeout';

export type ProbeResult =
  | { readonly kind: 'result'; readonly result: CheckResult }
  | { readonly kind: 'unchecked'; readonly reason: UncheckedReason };

export interface CheckRun {
  // keyed by item id, or by pull request ref for prs.tsv rows
  readonly results: ReadonlyMap<string, CheckResult>;
  readonly ran: number;
  readonly unchecked: number;
  readonly reason: UncheckedReason | 'mixed' | null;
  readonly elapsedMs: number;
}

// What a probe finds: its result, and for a pull request that is failing, the names of the checks
// that failed.
export interface CheckProbe {
  readonly result: ProbeResult;
  readonly failing: readonly string[];
}

export type CheckTarget =
  | { readonly kind: 'pr'; readonly number: string; readonly repo: string }
  | { readonly kind: 'branch'; readonly repoPath: string; readonly name: string }
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'pid'; readonly pid: number };

// The command a probe runs, which resolves `gh` and `git` through the PATH of the env it was given.
export type RunProbeCommand = (
  argv: readonly [string, ...string[]],
  timeoutMs: number,
) => Promise<CommandResult>;

export type CommandResult =
  | {
      readonly kind: 'exit';
      readonly code: number;
      readonly stdout: string;
      readonly stderr: string;
    }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'missing' };

export interface ProbeContext {
  readonly run: RunProbeCommand;
  readonly extra: Extra;
  readonly statPath?: StatPath;
}

export type StatPath = (path: string) => Promise<{ isDirectory: () => boolean }>;
