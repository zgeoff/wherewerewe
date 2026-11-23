import { join } from 'node:path';
import { match } from 'ts-pattern';
import type { StoreRead } from '../store/read-store.ts';
import type { Refusal } from '../types.ts';
import { buildRefusal } from './build-refusal.ts';

interface SessionPlace {
  readonly name: string;
  readonly folder: string;
}

type UnreadableStore = Exclude<
  StoreRead,
  { readonly kind: 'store' } | { readonly kind: 'missing' }
>;

// The refusal for a store that cannot be read as format 1. A store that is missing has no
// refusal here, because each command words that one itself.
export function buildReadRefusal(read: UnreadableStore, session: SessionPlace): Refusal {
  return match(read)
    .with({ kind: 'hand-kept' }, () => buildRefusal({ kind: 'hand-kept', name: session.name }))
    .with({ kind: 'newer' }, (found) =>
      buildRefusal({ kind: 'newer', name: session.name, format: found.format }),
    )
    .with({ kind: 'broken' }, (found) =>
      buildRefusal({
        kind: 'broken-store',
        name: session.name,
        file: found.file,
        path: join(session.folder, found.file),
        line: found.line,
        reason: found.reason,
      }),
    )
    .exhaustive();
}
