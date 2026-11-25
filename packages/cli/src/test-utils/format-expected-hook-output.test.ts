import { expect, test } from 'bun:test';
import { formatExpectedHookOutput } from './format-expected-hook-output.ts';

function setupTest() {
  return {
    format: formatExpectedHookOutput,
    base: { harness: 'claude', name: 'tide-alerts', injection: 'GOAL  Ship it\n' } as const,
  };
}

test('it prints the deny shape of a refusal and the Codex run line', () => {
  const ctx = setupTest();

  const claude = ctx.format({
    ...ctx.base,
    event: 'PreToolUse',
    output: { kind: 'refuse', reason: 'standard' },
  });

  const codex = ctx.format({
    ...ctx.base,
    harness: 'codex',
    event: 'PreToolUse',
    output: { kind: 'refuse', reason: 'cut' },
  });

  expect([claude, codex]).toStrictEqual([
    String.raw`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.\nRun: www"}}`,
    String.raw`{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"wherewerewe: www's output reached you cut, so tide-alerts's brief is not whole in your context.\nRun: www   (pass max_output_tokens 10000, so the whole brief reaches you)"}}`,
  ]);
});

test('it prints the injection, the Stop block, the fail-open line and the subagent line', () => {
  const ctx = setupTest();

  expect([
    ctx.format({ ...ctx.base, event: 'SessionStart', output: { kind: 'inject' } }),
    JSON.parse(ctx.format({ ...ctx.base, event: 'Stop', output: { kind: 'block' } })),
    JSON.parse(
      ctx.format({ ...ctx.base, event: 'PreToolUse', output: { kind: 'pass-with-line' } }),
    ),
    JSON.parse(ctx.format({ ...ctx.base, event: 'SubagentStart', output: { kind: 'pass' } })),
  ]).toStrictEqual([
    'GOAL  Ship it\n',
    expect.objectContaining({ decision: 'block' }),
    {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        additionalContext: expect.stringContaining('printed no whole brief for tide-alerts'),
      },
    },
    {
      hookSpecificOutput: {
        hookEventName: 'SubagentStart',
        additionalContext: expect.stringContaining('tide-alerts'),
      },
    },
  ]);
});

test('it prints nothing for a pass', () => {
  const ctx = setupTest();

  expect(ctx.format({ ...ctx.base, event: 'PreToolUse', output: { kind: 'pass' } })).toBe('');
});
