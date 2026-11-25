export function buildHookPayload(
  event: string,
  command?: string,
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    hook_event_name: event,
    session_id: 'host-1',
    ...(command === undefined ? {} : { tool_name: 'Bash', tool_input: { command } }),
    ...extra,
  });
}
