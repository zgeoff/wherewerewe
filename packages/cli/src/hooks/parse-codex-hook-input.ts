import { match } from 'ts-pattern';
import { isRecord } from './is-record.ts';
import { parseHookEnvelope } from './parse-hook-envelope.ts';
import type { HookEnvelope } from './parse-hook-envelope.ts';
import type { HookInput } from './types.ts';

// The hook input of Codex, or null for text that is not a payload of an event the hooks use. The
// Codex docs give no shape for a shell call's `tool_response`, so the text and the exit code are
// read by the rules of toResponse, and a shape they cannot read ends a brief read as failed.
export function parseCodexHookInput(text: string): HookInput | null {
  const envelope = parseHookEnvelope(text);

  if (envelope === null) {
    return null;
  }

  const base = { harness: 'codex', sessionID: envelope.sessionID } as const;
  const command = envelope.toolInput['command'];
  const maxOutputTokens = envelope.toolInput['max_output_tokens'];
  const response = toResponse(envelope);

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
      response: response.text,
      exitCode: response.exitCode,
      maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : null,
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

interface CodexResponse {
  readonly text: string;
  readonly exitCode: number | null;
}

// A string is the text as it is. An object gives its string field `output`, else `stdout`, else its
// JSON text, and its exit code from a numeric field `exit_code` or `exitCode`, when one is there.
function toResponse(envelope: HookEnvelope): CodexResponse {
  const response = envelope.toolResponse;

  if (typeof response === 'string') {
    return { text: response, exitCode: null };
  }

  if (!isRecord(response)) {
    return { text: JSON.stringify(response ?? ''), exitCode: null };
  }

  const output = response['output'];
  const stdout = response['stdout'];
  const exitCode = response['exit_code'] ?? response['exitCode'];

  return {
    text:
      [output, stdout].find((field): field is string => typeof field === 'string') ??
      JSON.stringify(response),
    exitCode: typeof exitCode === 'number' ? exitCode : null,
  };
}
