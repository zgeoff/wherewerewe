import { join } from 'node:path';
import { createSessionStore } from '../store/create-session-store.ts';

// Makes a format 1 session folder under the root through the store module, with no items and a
// journal that holds only its header. Returns the session folder.
export async function seedSessionStore(root: string, name: string): Promise<string> {
  await createSessionStore(
    root,
    {
      format: '1',
      name,
      goal: 'Ship the parser with its tests',
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
