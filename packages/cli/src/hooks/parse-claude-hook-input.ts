import { match } from 'ts-pattern';
import { isRecord } from './is-record.ts';
import { parseHookEnvelope } from './parse-hook-envelope.ts';
import type { HookEnvelope } from './parse-hook-envelope.ts';
import type { HookInput } from './types.ts';

// The hook input of Claude Code, or null for text that is not a payload of an event the hooks use.
export function parseClaudeHookInput(text: string): HookInput | null {
  const envelope = parseHookEnvelope(text);

  if (envelope === null) {
    return null;
  }

  const base = { harness: 'claude', sessionID: envelope.sessionID } as const;
  const command = envelope.toolInput['command'];

  return match(envelope.event)
    .with('SessionStart', (): HookInput => ({
      ...base,
      event: 'SessionStart',
      source: envelope.source,
    }))
    .with('PreToolUse', (): HookInput => ({
      ...base,
      event: 'PreToolUse',
      agentID: envelope.agentID,
      toolName: envelope.toolName,
      command: typeof command === 'string' ? command : null,
    }))
    .with('PostToolUse', (): HookInput => ({
      ...base,
      event: 'PostToolUse',
      agentID: envelope.agentID,
      toolName: envelope.toolName,
      command: typeof command === 'string' ? command : '',
      response: toResponseText(envelope),
      exitCode: null,
      maxOutputTokens: null,
    }))
    .with('PostToolUseFailure', (): HookInput => ({
      ...base,
      event: 'PostToolUseFailure',
      agentID: envelope.agentID,
      toolName: envelope.toolName,
      command: typeof command === 'string' ? command : '',
    }))
    .with('SubagentStart', (): HookInput => ({ ...base, event: 'SubagentStart' }))
    .with('Stop', (): HookInput => ({
      ...base,
      event: 'Stop',
      agentID: envelope.agentID,
      stopHookActive: envelope.stopHookActive,
    }))
    .otherwise(() => null);
}

// The Bash tool's output is an object with `stdout` beside `stderr`, `interrupted` and `isImage`.
function toResponseText(envelope: HookEnvelope): string {
  const response = envelope.toolResponse;

  if (typeof response === 'string') {
    return response;
  }

  const stdout = isRecord(response) ? response['stdout'] : undefined;

  return typeof stdout === 'string' ? stdout : JSON.stringify(response ?? '');
}
