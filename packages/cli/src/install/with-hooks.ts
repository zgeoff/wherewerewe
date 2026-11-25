import type { Harness } from '../types.ts';
import { isRecord } from '../utils/is-record.ts';
import type { Json } from './types.ts';

const events = [
  { event: 'SessionStart', timeout: 5 },
  { event: 'PreToolUse', timeout: 3 },
];

// The settings with this version's hook entries, and no entry an older version left behind.
export function withHooks(settings: Json, harness: Harness, bin: string): Json {
  const found = settings['hooks'];
  const before: Json = isRecord(found) ? found : {};
  const hooks: Record<string, unknown> = {};

  for (const [event, groups] of Object.entries(before)) {
    const kept = Array.isArray(groups) ? groups.filter((group) => !isOurs(group, harness)) : groups;

    if (!Array.isArray(kept) || kept.length > 0) {
      hooks[event] = kept;
    }
  }

  for (const entry of events) {
    const current = hooks[entry.event];
    const groups: unknown[] = Array.isArray(current) ? current : [];

    hooks[entry.event] = [
      ...groups,
      { hooks: [{ type: 'command', command: `${bin} hook ${harness}`, timeout: entry.timeout }] },
    ];
  }

  return { ...settings, hooks };
}

function isOurs(group: unknown, harness: Harness): boolean {
  const hooks = isRecord(group) ? group['hooks'] : undefined;

  return (
    Array.isArray(hooks) &&
    hooks.some((hook: unknown) => {
      const command = isRecord(hook) ? hook['command'] : undefined;

      return (
        typeof command === 'string' &&
        new RegExp(`wherewerewe"?'? hook ${harness}$`, 'u').test(command)
      );
    })
  );
}
