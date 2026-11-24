import type { ParsedArgs } from '../types.ts';

export interface CommandContext {
  readonly args: ParsedArgs;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly cwd: string;
  readonly nowMs: number;
  readonly root: string;

  // the terminal test of owner-notes.md
  readonly byOwner: boolean;
}
