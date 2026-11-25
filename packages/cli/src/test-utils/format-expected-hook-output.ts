import { gateTexts } from '../hooks/gate-texts.ts';
import type { GateOutput, Harness } from '../hooks/types.ts';

export interface ExpectedHookOutput {
  readonly event: 'SessionStart' | 'PreToolUse' | 'Stop' | 'SubagentStart';
  readonly output: GateOutput;
  readonly harness: Harness;
  readonly name: string;

  // what a SessionStart prints for the bound store
  readonly injection: string;
}

// The stdout the design gives a hook for a gate output, built from the design's JSON shapes alone,
// so a test can hold what the real hook printed against it, whole.
export function formatExpectedHookOutput(expected: ExpectedHookOutput): string {
  const name = expected.name;

  if (expected.event === 'SubagentStart') {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: gateTexts.subagentLine(name),
      },
    });
  }

  if (expected.output.kind === 'inject') {
    return expected.injection;
  }

  if (expected.output.kind === 'block') {
    return JSON.stringify({
      decision: 'block',
      reason: gateTexts.standardReason(name, expected.harness),
    });
  }

  if (expected.output.kind === 'refuse') {
    const reason =
      expected.output.reason === 'cut'
        ? gateTexts.cutReason(name)
        : gateTexts.standardReason(name, expected.harness);

    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: reason,
      },
    });
  }

  if (expected.output.kind === 'pass-with-line') {
    return JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: gateTexts.failOpenLine(name),
      },
    });
  }

  return '';
}
