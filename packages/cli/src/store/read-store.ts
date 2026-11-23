import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Store } from '../types.ts';
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
    };

// Reads `session`, stopping at a hand-kept or newer store, then `items.tsv`. Never the journal.
export async function readStore(folder: string): Promise<StoreRead> {
  const sessionText = await readTextOrNull(join(folder, 'session'));

  if (sessionText === null) {
    return { kind: 'missing' };
  }

  const session = parseSessionFile(sessionText);

  if (session.kind === 'hand-kept' || session.kind === 'newer') {
    return session;
  }

  if (session.kind === 'broken') {
    return { kind: 'broken', file: 'session', line: null, reason: session.reason };
  }

  const itemsText = await readTextOrNull(join(folder, 'items.tsv'));

  if (itemsText === null) {
    return { kind: 'broken', file: 'items.tsv', line: null, reason: 'the file is missing' };
  }

  const items = parseItemsFile(itemsText);

  if (items.kind === 'broken') {
    return { kind: 'broken', file: 'items.tsv', line: items.line, reason: items.reason };
  }

  return { kind: 'store', store: { folder, session: session.session, items: items.items } };
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
