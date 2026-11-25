import { isRecord } from '../hooks/is-record.ts';
import type { Harness } from '../hooks/types.ts';
import { isOurHandler } from './is-our-handler.ts';
import { parseJSONSettings } from './parse-json-settings.ts';

// The event of each wherewerewe hook command in one file, once per command. A JSON file lists them
// under `hooks`; a TOML file lists them in `[[hooks.<Event>…]]` tables, found line by line.
export function listOurHookEvents(
  text: string,
  format: 'json' | 'toml',
  harness: Harness,
): string[] {
  return format === 'json' ? listJSONEvents(text, harness) : listTOMLEvents(text, harness);
}

function listJSONEvents(text: string, harness: Harness): string[] {
  const read = parseJSONSettings(text);
  const hooks = read.kind === 'object' && isRecord(read.value['hooks']) ? read.value['hooks'] : {};

  return Object.entries(hooks).flatMap(([event, groups]) =>
    (Array.isArray(groups) ? groups : []).flatMap((group: unknown) =>
      isRecord(group) && Array.isArray(group['hooks'])
        ? group['hooks'].filter((handler) => isOurHandler(handler, harness)).map(() => event)
        : [],
    ),
  );
}

function listTOMLEvents(text: string, harness: Harness): string[] {
  let event: string | null = null;
  const found: string[] = [];

  for (const line of text.split('\n')) {
    const header = /^\s*\[+hooks\.(?<event>\w+)/u.exec(line)?.groups?.['event'];

    if (/^\s*\[/u.test(line)) {
      event = header ?? null;
    }

    const command = /^\s*command\s*=\s*"(?<command>[^"]*)"/u.exec(line)?.groups?.['command'];

    if (event !== null && command !== undefined && isOurHandler({ command }, harness)) {
      found.push(event);
    }
  }

  return found;
}
