import { expect, test } from 'bun:test';
import { briefFooter } from '../brief/join-brief.ts';
import { sortBriefEnd } from './sort-brief-end.ts';
import type { Harness, HookInput } from './types.ts';

function setupTest() {
  const whole = `tide-alerts · day 3 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  return {
    whole,
    sort: (harness: Harness, change: Partial<Extract<HookInput, { event: 'PostToolUse' }>>) =>
      sortBriefEnd(
        {
          event: 'PostToolUse',
          harness,
          sessionID: '9e1f-trial',
          agentID: null,
          toolName: 'Bash',
          command: 'www',
          response: whole,
          exitCode: null,
          maxOutputTokens: null,
          ...change,
        },
        'tide-alerts',
      ),
  };
}

test.each(['claude', 'codex'] as const)('it sorts a whole brief as whole on %s', (harness) => {
  const ctx = setupTest();

  expect(ctx.sort(harness, {})).toBe('whole');
});

test.each(['claude', 'codex'] as const)(
  'it accepts a brief with no final line break on %s',
  (harness) => {
    const ctx = setupTest();

    expect(ctx.sort(harness, { response: ctx.whole.replace(/\n$/u, '') })).toBe('whole');
  },
);

test.each([
  { title: 'the payload has agent_id', change: { agentID: 'sub-1' } },
  { title: 'the tool is not Bash', change: { toolName: 'Read' } },
  { title: 'the command is piped', change: { command: 'www | tail -1' } },
  { title: 'the command is www --json', change: { command: 'www --json' } },
  { title: 'the command is www --session other', change: { command: 'www --session other' } },
])('it gives null when $title', (row) => {
  const ctx = setupTest();

  expect(ctx.sort('claude', row.change)).toBeNull();
});

test('it gives null for an event that is not an end', () => {
  const sorted = sortBriefEnd(
    {
      event: 'PreToolUse',
      harness: 'claude',
      sessionID: '9e1f-trial',
      agentID: null,
      toolName: 'Bash',
      command: 'www',
    },
    'tide-alerts',
  );

  expect(sorted).toBeNull();
});

test.each(['claude', 'codex'] as const)(
  'it sorts a PostToolUseFailure of the brief command as failed on %s',
  (harness) => {
    const sorted = sortBriefEnd(
      {
        event: 'PostToolUseFailure',
        harness: 'claude',
        sessionID: '9e1f-trial',
        agentID: null,
        toolName: 'Bash',
        command: 'www',
      },
      'tide-alerts',
    );

    expect({ harness, sorted }).toStrictEqual({ harness, sorted: 'failed' });
  },
);

test.each(['claude', 'codex'] as const)(
  'it sorts a brief that breaks one clause as failed on %s',
  (harness) => {
    const ctx = setupTest();

    expect([
      ctx.sort(harness, { response: ctx.whole.replace('tide-alerts · day', 'docs-move · day') }),
      ctx.sort(harness, { response: ctx.whole.replace(briefFooter, 'cut here') }),
      ctx.sort(harness, { response: '' }),
      ctx.sort(harness, { response: 'www: tide-alerts: no such session' }),
    ]).toStrictEqual(['failed', 'failed', 'failed', 'failed']);
  },
);

test('it sorts a Codex exit code that is not 0 as failed, and an exit code of 0 as whole', () => {
  const ctx = setupTest();

  expect([ctx.sort('codex', { exitCode: 1 }), ctx.sort('codex', { exitCode: 0 })]).toStrictEqual([
    'failed',
    'whole',
  ]);
});

test('it sorts a Claude Code brief with a persisted-output marker as failed', () => {
  const ctx = setupTest();
  const response = ctx.whole.replace('GOAL', '<persisted-output>\nGOAL');

  expect(ctx.sort('claude', { response })).toBe('failed');
});

test('it sorts a Codex brief with a truncation marker, header and footer as cut', () => {
  const ctx = setupTest();

  expect(
    ctx.sort('codex', { response: ctx.whole.replace('GOAL', '…2000 tokens truncated…\nGOAL') }),
  ).toBe('cut');
});

test('it sorts a Codex brief that passes max_output_tokens times 4 as cut, and one at the cap as whole', () => {
  const ctx = setupTest();
  const bytes = Buffer.byteLength(ctx.whole, 'utf8');

  expect([
    ctx.sort('codex', { maxOutputTokens: Math.floor(bytes / 4) - 1 }),
    ctx.sort('codex', { maxOutputTokens: Math.ceil(bytes / 4) }),
  ]).toStrictEqual(['cut', 'whole']);
});

test('it ignores max_output_tokens on Claude Code', () => {
  const ctx = setupTest();

  expect(ctx.sort('claude', { maxOutputTokens: 1 })).toBe('whole');
});
