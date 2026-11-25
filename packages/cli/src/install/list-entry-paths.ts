import { isRecord } from '../hooks/is-record.ts';
import type { Harness } from '../hooks/types.ts';
import { isOurHandler } from './is-our-handler.ts';
import { parseJSONSettings } from './parse-json-settings.ts';

// The path that each wherewerewe hook command of a hooks file runs: the command without its
// `hook <harness>` and without the quotes around a path that holds a space.
export function listEntryPaths(text: string | null, harness: Harness): string[] {
  const read = parseJSONSettings(text ?? '');
  const hooks = read.kind === 'object' && isRecord(read.value['hooks']) ? read.value['hooks'] : {};
  const suffix = ` hook ${harness}`;

  return Object.values(hooks).flatMap((groups) =>
    (Array.isArray(groups) ? groups : []).flatMap((group: unknown) =>
      isRecord(group) && Array.isArray(group['hooks'])
        ? group['hooks']
            .filter((handler) => isOurHandler(handler, harness))
            .map((handler) => unquote(readCommand(handler).slice(0, -suffix.length)))
        : [],
    ),
  );
}

function unquote(path: string): string {
  const isQuoted =
    path.length > 1 &&
    ((path.startsWith('"') && path.endsWith('"')) || (path.startsWith("'") && path.endsWith("'")));

  return isQuoted ? path.slice(1, -1) : path;
}

function readCommand(handler: unknown): string {
  return isRecord(handler) && typeof handler['command'] === 'string' ? handler['command'] : '';
}
