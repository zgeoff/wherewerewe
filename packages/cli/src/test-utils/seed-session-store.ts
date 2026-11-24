import { join } from 'node:path';
import { createSessionStore } from '../store/create-session-store.ts';
import type { Grant } from '../types.ts';

// Makes a format 2 session folder under the root through the store module, with no items, the
// grant given or none, and a journal that holds only its header. Returns the session folder.
export async function seedSessionStore(
  root: string,
  name: string,
  grant: Grant | null = null,
): Promise<string> {
  await createSessionStore(
    root,
    {
      format: '2',
      name,
      goal: 'Ship the parser with its tests',
      grant,
      started: '2026-03-02T08:04:11Z',
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: null,
      lastNudge: null,
      importedFrom: null,
    },
    [],
  );

  return join(root, name);
}
