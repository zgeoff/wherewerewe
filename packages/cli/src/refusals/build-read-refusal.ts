import { join } from 'node:path';
import type { StoreRead } from '../store/read-store.ts';
import type { Refusal } from '../types.ts';
import { buildRefusal } from './build-refusal.ts';

interface SessionPlace {
  readonly name: string;
  readonly folder: string;
}

// The refusal for a store that cannot be read as format 1. A store that is missing has no
// refusal here, because each command words that one itself.
export function buildReadRefusal(read: StoreRead, session: SessionPlace): Refusal | null {
  if (read.kind === 'hand-kept') {
    return buildRefusal({ kind: 'hand-kept', name: session.name });
  }

  if (read.kind === 'newer') {
    return buildRefusal({ kind: 'newer', name: session.name, format: read.format });
  }

  if (read.kind === 'broken') {
    return buildRefusal({
      kind: 'broken-store',
      name: session.name,
      file: read.file,
      path: join(session.folder, read.file),
      line: read.line,
      reason: read.reason,
    });
  }

  return null;
}
