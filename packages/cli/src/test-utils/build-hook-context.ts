import { setImmediate } from 'node:timers/promises';
import type { HookContext } from '../hooks/types.ts';

// A hook context over a store root: a fixed clock, and a wait that yields to the event loop without a delay
// unless the caller gives one.
export function buildHookContext(
  root: string,
  sleep: HookContext['sleep'] = () => setImmediate(),
): HookContext {
  return {
    env: {},
    now: () => Date.parse('2026-03-10T11:43:00Z'),
    root,
    sleep,
    faultSleepMs: 0,
    fault: null,
  };
}
