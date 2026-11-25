import type { ParsedArgs, UpgradeRun } from '../types.ts';

export interface CommandContext {
  readonly args: ParsedArgs;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly nowMs: number;

  // the clock itself, which a read runs its checks against
  readonly now: () => number;
  readonly root: string;

  // the terminal test of owner-notes.md
  readonly byOwner: boolean;

  // the line that upgrades this www, for a refusal of a store of a newer format
  readonly upgradeRun: UpgradeRun;
}

// The time a read runs at and the folder it runs in.
export interface ReadAt {
  readonly nowMs: number;
  readonly cwd: string;
}
