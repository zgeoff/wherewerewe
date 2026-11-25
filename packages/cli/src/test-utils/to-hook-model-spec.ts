import { match } from 'ts-pattern';
import { briefFooter } from '../brief/join-brief.ts';
import type { HookPayloadSpec } from './build-hook-payload.ts';
import type { HookModelCall } from './run-hook-model.ts';

// The payload of a model call: each event in the host's shape, with agent_id for a subagent's call.
export function toHookModelSpec(call: HookModelCall): HookPayloadSpec {
  const agentID = call.from === 'subagent' ? 'sub-1' : undefined;
  const withAgent = agentID === undefined ? {} : { agentID };
  const whole = `tide-alerts · day 1 · Tue 2026-03-10 11:43Z · no checks\nGOAL  Ship it\n${briefFooter}\n`;

  return match(call.payload)
    .with('start-startup', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'startup' }))
    .with('start-resume', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'resume' }))
    .with('start-clear', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'clear' }))
    .with('start-compact', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'compact' }))
    .with('start-fork', (): HookPayloadSpec => ({ event: 'SessionStart', source: 'fork' }))
    .with('subagent-start', (): HookPayloadSpec => ({ event: 'SubagentStart' }))
    .with('pre-brief', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www',
      ...withAgent,
    }))
    .with('pre-brief-session', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www --session tide-alerts',
      ...withAgent,
    }))
    .with('pre-www-list', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www list rules',
      ...withAgent,
    }))
    .with('pre-www-pipe', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: 'www | tail -1',
      ...withAgent,
    }))
    .with('pre-ls', (): HookPayloadSpec => ({ event: 'PreToolUse', command: 'ls', ...withAgent }))
    .with('pre-mcp', (): HookPayloadSpec => ({
      event: 'PreToolUse',
      command: null,
      toolName: 'mcp__tides__lookup',
      ...withAgent,
    }))
    .with('end-whole', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: whole,
      ...withAgent,
    }))
    .with('end-cut', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: whole.replace('GOAL', '…3000 tokens truncated…\nGOAL'),
      ...withAgent,
    }))
    .with('end-failed', (): HookPayloadSpec => ({
      event: 'PostToolUse',
      command: 'www',
      output: 'www: command not found',
      ...withAgent,
    }))
    .with('stop', (): HookPayloadSpec => ({ event: 'Stop', ...withAgent }))
    .with('stop-active', (): HookPayloadSpec => ({
      event: 'Stop',
      stopHookActive: true,
      ...withAgent,
    }))
    .exhaustive();
}
