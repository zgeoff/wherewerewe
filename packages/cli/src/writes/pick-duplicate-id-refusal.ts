import { join } from 'node:path';
import type { RefusalReason } from '../types.ts';
import { collectIDHolders, formatIDHolder } from './collect-id-holders.ts';
import type { WriteInput } from './types.ts';

// The refusal for an id that two of the four files hold open, as the tool of an earlier version can
// leave it. Every write, close, set and now on the id refuses; nothing is dropped.
export function pickDuplicateIDRefusal(input: WriteInput, id: string): RefusalReason | null {
  const [first, second] = collectIDHolders(input.store, id);

  return first === undefined || second === undefined
    ? null
    : {
        kind: 'id-held-twice',
        name: input.store.session.name,
        id,
        first: formatIDHolder(first),
        second: formatIDHolder(second),
        path: join(input.store.folder, second.file),
      };
}
