import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import type { OwnerNote, SessionFile, Store, UnreadRows } from '../types.ts';
import { parseItemsFile } from './parse-items-file.ts';
import { parseOwnerFile } from './parse-owner-file.ts';
import { parseSessionFile } from './parse-session-file.ts';

export type StoreRead =
  | { readonly kind: 'store'; readonly store: Store }
  | { readonly kind: 'missing' }
  | { readonly kind: 'hand-kept' }
  | { readonly kind: 'newer'; readonly format: string }
  | {
      readonly kind: 'broken';
      readonly file: string;
      readonly line: number | null;
      readonly reason: string;

      // what a read can still print: the session, with the item rows that parse. A write never
      // uses it. Null when the session file itself is broken.
      readonly partial: Store | null;
    };

// Reads `session`, stopping at a hand-kept or newer store, then `items.tsv`, then `owner.tsv`. A
// broken `owner.tsv` never makes the store broken: its rows that parse come back with the rows that
// do not named in `ownerUnread`. Never the journal.
export async function readStore(folder: string): Promise<StoreRead> {
  const sessionText = await readTextOrNull(join(folder, 'session'));

  if (sessionText === null) {
    return { kind: 'missing' };
  }

  return match(parseSessionFile(sessionText))
    .with({ kind: 'hand-kept' }, (found): StoreRead => found)
    .with({ kind: 'newer' }, (found): StoreRead => found)
    .with({ kind: 'broken' }, (found): StoreRead => ({
      kind: 'broken',
      file: 'session',
      line: null,
      reason: found.reason,
      partial: null,
    }))
    .with({ kind: 'session' }, (found) => readItems(folder, found.session))
    .exhaustive();
}

async function readTextOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function readItems(folder: string, session: SessionFile): Promise<StoreRead> {
  const itemsText = await readTextOrNull(join(folder, 'items.tsv'));
  const owner = await readOwner(folder);

  if (itemsText === null) {
    return {
      kind: 'broken',
      file: 'items.tsv',
      line: null,
      reason: 'the file is missing',
      partial: { folder, session, items: [], ...owner },
    };
  }

  return match(parseItemsFile(itemsText))
    .with({ kind: 'items' }, (found): StoreRead => ({
      kind: 'store',
      store: { folder, session, items: found.items, ...owner },
    }))
    .with({ kind: 'broken' }, (found): StoreRead => ({
      kind: 'broken',
      file: 'items.tsv',
      line: found.line,
      reason: found.reason,
      partial: { folder, session, items: found.items, ...owner },
    }))
    .exhaustive();
}

interface OwnerRead {
  readonly ownerNotes: readonly OwnerNote[];
  readonly ownerUnread: UnreadRows | null;
}

async function readOwner(folder: string): Promise<OwnerRead> {
  const ownerText = await readTextOrNull(join(folder, 'owner.tsv'));

  if (ownerText === null) {
    return { ownerNotes: [], ownerUnread: null };
  }

  return match(parseOwnerFile(ownerText))
    .with({ kind: 'notes' }, (found): OwnerRead => ({ ownerNotes: found.notes, ownerUnread: null }))
    .with({ kind: 'broken' }, (found): OwnerRead => ({
      ownerNotes: found.notes,
      ownerUnread: { file: 'owner.tsv', line: found.line, reason: found.reason },
    }))
    .exhaustive();
}
