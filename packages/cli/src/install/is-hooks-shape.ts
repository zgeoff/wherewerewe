import { isRecord } from '../hooks/is-record.ts';

// Whether the parts of a settings object that install edits have the types a hosts reads: `hooks`
// an object, each event in `events` a list of groups, each group an object whose `hooks` is a list
// of objects.
export function isHooksShape(
  settings: Readonly<Record<string, unknown>>,
  events: readonly string[],
): boolean {
  const hooks = settings['hooks'];

  if (hooks === undefined) {
    return true;
  }

  if (!isRecord(hooks)) {
    return false;
  }

  return events.every((event) => {
    const groups = hooks[event];

    return (
      groups === undefined ||
      (Array.isArray(groups) && groups.every((group) => isGroupShape(group)))
    );
  });
}

function isGroupShape(group: unknown): boolean {
  if (!isRecord(group)) {
    return false;
  }

  const handlers = group['hooks'];

  return (
    handlers === undefined ||
    (Array.isArray(handlers) && handlers.every((handler) => isRecord(handler)))
  );
}
