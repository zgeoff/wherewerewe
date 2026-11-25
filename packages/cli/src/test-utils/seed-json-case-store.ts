import { chmodSync } from 'node:fs';
import { join } from 'node:path';
import { match } from 'ts-pattern';
import { seedFormat1Store } from './seed-format-1-store.ts';
import { seedItem } from './seed-item.ts';
import { seedLockFile } from './seed-lock-file.ts';
import { seedSessionStore } from './seed-session-store.ts';
import { seedStoreFile } from './seed-store-file.ts';

export type JsonCase =
  | 'a whole store'
  | 'a notes row that does not parse'
  | 'a held lock'
  | 'a read-only store folder'
  | 'no session'
  | 'a format 1 store'
  | 'a hand-kept store'
  | 'a newer store'
  | 'a session that does not parse';

// The session tide-alerts under the root's wherewerewe folder, in the state of the case. It holds
// one task with a path check, so a brief probes. Returns what restores a folder the case made
// read-only.
export async function seedJsonCaseStore(root: string, state: JsonCase): Promise<() => void> {
  const stateRoot = join(root, 'wherewerewe');
  const folder = join(stateRoot, 'tide-alerts');

  const restore = await match(state)
    .with('no session', () => () => {})
    .with('a format 1 store', () => {
      seedFormat1Store(stateRoot, 'tide-alerts');

      return () => {};
    })
    .with('a hand-kept store', () => {
      seedStoreFile(
        folder,
        'session',
        'name=tide-alerts\ngoal=Ship it\nstarted=2026-04-06T09:00:00Z\nformat=0-by-hand\n',
      );

      return () => {};
    })
    .with('a newer store', () => {
      seedStoreFile(folder, 'session', 'format=3\n');

      return () => {};
    })
    .with('a session that does not parse', () => {
      seedStoreFile(folder, 'session', 'format=2\nname=tide-alerts\nstarted=yesterday\n');

      return () => {};
    })
    .with(
      'a whole store',
      'a notes row that does not parse',
      'a held lock',
      'a read-only store folder',
      () => seedWholeStore(root, folder, state),
    )
    .exhaustive();

  return restore;
}

async function seedWholeStore(root: string, folder: string, state: JsonCase): Promise<() => void> {
  await seedSessionStore(join(root, 'wherewerewe'), 'tide-alerts');
  await seedItem(folder, { id: 't-a', check: `path:${root}`, atWrite: 'exists', last: 'exists' });

  if (state === 'a notes row that does not parse') {
    seedStoreFile(folder, 'notes.tsv', 'id\towed\twritten\tnote\nt-a\n');
  }

  if (state === 'a held lock') {
    seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);
  }

  if (state === 'a read-only store folder') {
    chmodSync(folder, 0o555);

    return () => {
      chmodSync(folder, 0o755);
    };
  }

  return () => {};
}
