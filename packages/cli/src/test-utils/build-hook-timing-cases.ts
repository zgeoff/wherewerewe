import { briefFooter } from '../brief/join-brief.ts';
import type { Harness } from '../hooks/types.ts';
import type { HookPayloadSpec } from './build-hook-payload.ts';

export const boundHookID = '9e1f-trial';

export interface HookTimingCase {
  readonly harness: Harness;
  readonly title: string;

  // the agent session id of the payload: bound in the store, or a stranger's
  readonly id: string;
  readonly limitMs: number;
  readonly spec: HookPayloadSpec;
}

// The cases of the design's timing bounds, on both harnesses: an unbound PreToolUse or Stop and a
// bound PreToolUse or Stop under 150 ms, and a bound PostToolUse or SessionStart under 300 ms.
export function buildHookTimingCases(): readonly HookTimingCase[] {
  const whole = `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  return (['claude', 'codex'] as const).flatMap((harness) => [
    {
      harness,
      title: 'an unbound PreToolUse',
      id: '7c2d-stranger',
      limitMs: 150,
      spec: { event: 'PreToolUse', command: 'ls' },
    },
    {
      harness,
      title: 'a bound PreToolUse',
      id: boundHookID,
      limitMs: 150,
      spec: { event: 'PreToolUse', command: 'ls' },
    },
    {
      harness,
      title: 'an unbound Stop',
      id: '7c2d-stranger',
      limitMs: 150,
      spec: { event: 'Stop' },
    },
    { harness, title: 'a bound Stop', id: boundHookID, limitMs: 150, spec: { event: 'Stop' } },
    {
      harness,
      title: 'a bound PostToolUse',
      id: boundHookID,
      limitMs: 300,
      spec: { event: 'PostToolUse', command: 'www', output: whole },
    },
    {
      harness,
      title: 'a bound SessionStart',
      id: boundHookID,
      limitMs: 300,
      spec: { event: 'SessionStart' },
    },
  ]);
}
