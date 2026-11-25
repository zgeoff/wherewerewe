import type { Harness } from '../hooks/types.ts';
import type { HookEntry } from './build-hook-entries.ts';
import { buildHookGroup } from './build-hook-group.ts';
import { isHooksShape } from './is-hooks-shape.ts';
import { parseJSONSettings } from './parse-json-settings.ts';
import { planEventEdit } from './plan-event-edit.ts';

export type HookMerge =
  | { readonly kind: 'unreadable' }
  | {
      readonly kind: 'merged';
      readonly text: string;
      readonly counts: {
        readonly added: number;
        readonly replaced: number;
        readonly removed: number;
      };
    };

// The settings text with each entry of the harness in place: every other byte of the text stays,
// an older wherewerewe entry is replaced where it stands, and a second wherewerewe entry in one
// event is removed. A missing or blank file gives a new one. `null` text means no file.
export function mergeHookEntries(
  text: string | null,
  harness: Harness,
  entries: readonly HookEntry[],
): HookMerge {
  const read = parseJSONSettings(text ?? '');

  if (
    read.kind === 'unreadable' ||
    (read.kind === 'object' &&
      !isHooksShape(
        read.value,
        entries.map((entry) => entry.event),
      ))
  ) {
    return { kind: 'unreadable' };
  }

  if (read.kind === 'blank' || text === null) {
    const hooks = Object.fromEntries(
      entries.map((entry) => [entry.event, [buildHookGroup(entry)]]),
    );

    return {
      kind: 'merged',
      text: `${JSON.stringify({ hooks }, null, 2)}\n`,
      counts: { added: entries.length, replaced: 0, removed: 0 },
    };
  }

  return entries.reduce<HookMerge>(
    (merge, entry) => (merge.kind === 'merged' ? mergeEntry(merge, harness, entry) : merge),
    { kind: 'merged', text, counts: { added: 0, replaced: 0, removed: 0 } },
  );
}

function mergeEntry(
  merge: HookMerge & { kind: 'merged' },
  harness: Harness,
  entry: HookEntry,
): HookMerge {
  let text = merge.text;
  const counts = { ...merge.counts };

  for (let step = 0; step < 50; step += 1) {
    const edit = planEventEdit(text, harness, entry);

    if (edit.kind === 'same') {
      break;
    }

    counts[edit.kind] += 1;
    text = edit.text;
  }

  return { kind: 'merged', text, counts };
}
