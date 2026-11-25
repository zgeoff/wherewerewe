import { match } from 'ts-pattern';
import type { Harness } from '../hooks/types.ts';

export type HookPayloadSpec =
  | { readonly event: 'SessionStart'; readonly source?: string }
  | {
      readonly event: 'PreToolUse';
      readonly command: string | null;
      readonly toolName?: string;
      readonly agentID?: string;
    }
  | {
      readonly event: 'PostToolUse';
      readonly command: string;
      readonly output: string;
      readonly exitCode?: number;
      readonly maxOutputTokens?: number;
      readonly agentID?: string;
    }
  | { readonly event: 'PostToolUseFailure'; readonly command: string; readonly agentID?: string }
  | { readonly event: 'SubagentStart' }
  | { readonly event: 'Stop'; readonly stopHookActive?: boolean; readonly agentID?: string };

// The stdin text of one hook event, in the shape that host's docs give. A Codex `tool_response` for
// a shell call is a plain string, since the docs give no shape for it.
export function buildHookPayload(
  harness: Harness,
  sessionID: string,
  spec: HookPayloadSpec,
): string {
  const base = { session_id: sessionID, hook_event_name: spec.event };

  const fields = match(spec)
    .with({ event: 'SessionStart' }, (start) => ({ source: start.source ?? 'startup' }))
    .with({ event: 'PreToolUse' }, (pre) => ({
      tool_name: pre.toolName ?? 'Bash',
      tool_input: pre.command === null ? {} : { command: pre.command },
      ...(pre.agentID === undefined ? {} : { agent_id: pre.agentID }),
    }))
    .with({ event: 'PostToolUse' }, (post) => ({
      tool_name: 'Bash',
      tool_input: {
        command: post.command,
        ...(post.maxOutputTokens === undefined ? {} : { max_output_tokens: post.maxOutputTokens }),
      },
      tool_response:
        harness === 'claude'
          ? { stdout: post.output, stderr: '', interrupted: false, isImage: false }
          : post.output,
      ...(post.agentID === undefined ? {} : { agent_id: post.agentID }),
    }))
    .with({ event: 'PostToolUseFailure' }, (failure) => ({
      tool_name: 'Bash',
      tool_input: { command: failure.command },
      error: 'Command failed',
      ...(failure.agentID === undefined ? {} : { agent_id: failure.agentID }),
    }))
    .with({ event: 'SubagentStart' }, () => ({ agent_id: 'sub-1' }))
    .with({ event: 'Stop' }, (stop) => ({
      stop_hook_active: stop.stopHookActive ?? false,
      ...(stop.agentID === undefined ? {} : { agent_id: stop.agentID }),
    }))
    .exhaustive();

  return JSON.stringify({ ...base, ...fields });
}
