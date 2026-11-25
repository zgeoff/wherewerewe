import { expect, test } from 'bun:test';
import { toHookDecision } from './to-hook-decision.ts';

function setupTest() {
  return { decide: toHookDecision };
}

test.each([
  { title: 'nothing', stdout: '', decision: 'pass' },
  { title: 'the injection', stdout: 'GOAL  Ship it\n', decision: 'inject' },
  {
    title: 'a deny',
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"wherewerewe: this session started"}}',
    decision: 'refuse',
  },
  {
    title: 'a deny after a cut read',
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"wherewerewe: www\'s output reached you cut"}}',
    decision: 'refuse-cut',
  },
  {
    title: 'the fail-open line',
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"wherewerewe: www printed no whole brief for x"}}',
    decision: 'pass+line',
  },
  {
    title: 'a Stop block',
    stdout: '{"decision":"block","reason":"wherewerewe: this session"}',
    decision: 'block',
  },
  {
    title: 'a nudge',
    stdout:
      '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":"wherewerewe: you pushed"}}',
    decision: 'context',
  },
  { title: 'text that is not JSON', stdout: '{"decision":"block"}x', decision: 'other' },
] as const)('it reads $title as $decision', (row) => {
  const ctx = setupTest();

  expect(ctx.decide(row.stdout)).toBe(row.decision);
});
