import { isRecord } from '../hooks/is-record.ts';
import type { Harness } from '../hooks/types.ts';
import { isOurHandler } from './is-our-handler.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import { parseTOMLConfig } from './parse-toml-config.ts';

// The event of each wherewerewe hook command in one file, once per command. A JSON file lists them
// under `hooks`; a TOML file lists them in `[[hooks.<Event>…]]` tables.
export function listOurHookEvents(
  text: string,
  format: 'json' | 'toml',
  harness: Harness,
): string[] {
  return format === 'json' ? listJSONEvents(text, harness) : listTOMLEvents(text, harness);
}

function listJSONEvents(text: string, harness: Harness): string[] {
  const read = parseJSONSettings(text);

  return read.kind === 'object' ? listHookTableEvents(read.value['hooks'], harness) : [];
}

// The `hooks` table of either file: each event holds a list of groups, and each group a list of
// handlers.
function listHookTableEvents(hooks: unknown, harness: Harness): string[] {
  const table = isRecord(hooks) ? hooks : {};

  return Object.entries(table).flatMap(([event, groups]) =>
    (Array.isArray(groups) ? groups : []).flatMap((group: unknown) =>
      isRecord(group) && Array.isArray(group['hooks'])
        ? group['hooks'].filter((handler) => isOurHandler(handler, harness)).map(() => event)
        : [],
    ),
  );
}

function listTOMLEvents(text: string, harness: Harness): string[] {
  return listHookTableEvents(parseTOMLConfig(text)?.['hooks'], harness);
}
