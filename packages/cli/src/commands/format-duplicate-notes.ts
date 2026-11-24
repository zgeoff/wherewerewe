import { join } from 'node:path';
import { formatRefusal } from '../refusals/format-refusal.ts';
import type { Store } from '../types.ts';
import { collectIDHolders, collectOpenIDs, formatIDHolder } from '../writes/collect-id-holders.ts';

// One note on stderr for each id that two of the four files hold open, with the fix of the write
// refusal. A read prints both rows and drops neither.
export function formatDuplicateNotes(store: Store): string {
  const ids = [...new Set(collectOpenIDs(store))];

  return ids
    .flatMap((id) => {
      const [first, second] = collectIDHolders(store, id);

      return first === undefined || second === undefined
        ? []
        : [
            formatRefusal(
              {
                exitCode: 3,
                lines: [
                  `www: ${store.session.name} holds ${id} twice, as ${formatIDHolder(first)} and as ${formatIDHolder(second)}. Rename one of them by hand; the journal keeps both.`,
                ],
                runs: [{ shell: ['less', join(store.folder, second.file)] }],
              },
              { sessionFlag: null },
            ),
          ];
    })
    .join('');
}
