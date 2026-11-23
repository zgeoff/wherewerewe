import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import type { SessionFile, Store } from '../types.ts';
import { parseItemsFile } from './parse-items-file.ts';
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

// Reads `session`, stopping at a hand-kept or newer store, then `items.tsv`. Never the journal.
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

  if (itemsText === null) {
    return {
      kind: 'broken',
      file: 'items.tsv',
      line: null,
      reason: 'the file is missing',
      partial: { folder, session, items: [] },
    };
  }

  return match(parseItemsFile(itemsText))
    .with({ kind: 'items' }, (found): StoreRead => ({
      kind: 'store',
      store: { folder, session, items: found.items },
    }))
    .with({ kind: 'broken' }, (found): StoreRead => ({
      kind: 'broken',
      file: 'items.tsv',
      line: found.line,
      reason: found.reason,
      partial: { folder, session, items: found.items },
    }))
    .exhaustive();
}
