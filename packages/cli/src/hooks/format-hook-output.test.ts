import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { formatHookOutput } from './format-hook-output.ts';

function setupTest() {
  return { format: formatHookOutput };
}

test('it prints the deny shape of the design for a standard refusal on Claude Code', () => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: { kind: 'refuse', reason: 'standard' },
    event: 'PreToolUse',
    harness: 'claude',
    name: 'tide-alerts',
    text: '',
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        "wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.\nRun: www",
    },
  });
});

test('it prints the Codex Run line and the cut reason for a refusal after a cut read', () => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: { kind: 'refuse', reason: 'cut' },
    event: 'PreToolUse',
    harness: 'codex',
    name: 'tide-alerts',
    text: '',
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        "wherewerewe: www's output reached you cut, so tide-alerts's brief is not whole in your context.\nRun: www   (pass max_output_tokens 10000, so the whole brief reaches you)",
    },
  });
});

test('it prints the additionalContext shape of the design for a pass with the line', () => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: { kind: 'pass-with-line' },
    event: 'PreToolUse',
    harness: 'claude',
    name: 'tide-alerts',
    text: '',
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        "wherewerewe: www printed no whole brief for tide-alerts, so this session's tool calls go through until the next resume or compaction.",
    },
  });
});

test('it prints the Stop block of the design', () => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: { kind: 'block' },
    event: 'Stop',
    harness: 'codex',
    name: 'tide-alerts',
    text: '',
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    decision: 'block',
    reason:
      "wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.\nRun: www   (pass max_output_tokens 10000, so the whole brief reaches you)",
  });
});

test('it prints the injection as plain text', () => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: { kind: 'inject' },
    event: 'SessionStart',
    harness: 'claude',
    name: 'tide-alerts',
    text: 'GOAL  Ship it\n',
  });

  expect(stdout).toBe('GOAL  Ship it\n');
});

test.each([
  { event: 'PostToolUse', output: { kind: 'pass' } },
  { event: 'SubagentStart', output: { kind: 'pass' } },
] as const)('it prints the one line of a $event as additionalContext', (row) => {
  const ctx = setupTest();

  const stdout = ctx.format({
    output: row.output,
    event: row.event,
    harness: 'claude',
    name: 'tide-alerts',
    text: 'A line',
  });

  expect(JSON.parse(stdout)).toStrictEqual({
    hookSpecificOutput: { hookEventName: row.event, additionalContext: 'A line' },
  });
});

test.each([
  { event: 'PreToolUse', output: { kind: 'pass' } },
  { event: 'Stop', output: { kind: 'none' } },
  { event: 'PostToolUse', output: { kind: 'none' } },
] as const)('it prints nothing for a plain pass of a $event with no line', (row) => {
  const ctx = setupTest();

  expect(
    ctx.format({
      output: row.output,
      event: row.event,
      harness: 'claude',
      name: 'tide-alerts',
      text: '',
    }),
  ).toBe('');
});

test('it redacts a credential word of a line before it encodes the JSON', () => {
  const ctx = setupTest();
  const sample = buildCredentialSamples()[0]?.sample ?? '';

  const stdout = ctx.format({
    output: { kind: 'pass' },
    event: 'PostToolUse',
    harness: 'claude',
    name: 'tide-alerts',
    text: `wherewerewe: you pushed ${sample}`,
  });

  expect(stdout).not.toContain(sample.slice(0, 10));
});
