import type { HookEntry } from './build-hook-entries.ts';

interface HookHandler {
  readonly type: 'command';
  readonly command: string;
  readonly timeout: number;
}

export interface HookGroup {
  readonly matcher?: string;
  readonly hooks: readonly HookHandler[];
}

// The matcher group of one entry, in the shape both hosts' hooks files take.
export function buildHookGroup(entry: HookEntry): HookGroup {
  const handler: HookHandler = {
    type: 'command',
    command: entry.command,
    timeout: entry.timeoutSeconds,
  };

  return entry.matcher === null
    ? { hooks: [handler] }
    : { matcher: entry.matcher, hooks: [handler] };
}
