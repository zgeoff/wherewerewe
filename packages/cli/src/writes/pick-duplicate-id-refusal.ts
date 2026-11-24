import { join } from 'node:path';
import { getKindWord } from '../rules/get-kind-word.ts';
import type { RefusalReason } from '../types.ts';
import { collectIDHolders } from './collect-id-holders.ts';
import type { IDHolder } from './collect-id-holders.ts';
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
        first: describeHolder(first),
        second: describeHolder(second),
        path: join(input.store.folder, second.file),
      };
}

function describeHolder(holder: IDHolder): string {
  return holder.kind === 'words'
    ? `the owner's words in ${holder.file}`
    : `a ${getKindWord(holder.kind)} in ${holder.file}`;
}
