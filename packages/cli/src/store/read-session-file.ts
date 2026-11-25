import { join } from 'node:path';
import { parseSessionFile } from './parse-session-file.ts';
import type { SessionParse } from './parse-session-file.ts';
import { readTextOrNull } from './read-text-or-null.ts';

export type SessionRead = { readonly kind: 'missing' } | SessionParse;

// Reads the `session` file of a folder alone, and no other file of the store.
export async function readSessionFile(folder: string): Promise<SessionRead> {
  const text = await readTextOrNull(join(folder, 'session'));

  return text === null ? { kind: 'missing' } : parseSessionFile(text);
}
