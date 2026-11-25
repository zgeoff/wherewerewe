import { chmodSync, copyFileSync, existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import { readTextOrNull } from './read-text-or-null.ts';

export interface InstalledFileRequest {
  readonly path: string;

  // the mode of a file that does not exist yet; an existing file keeps its own
  readonly newMode: number;

  // the new text for the old text, or `null` when the file stays as it is
  readonly plan: (before: string | null) => string | null;
}

export interface InstallWriteSeam {
  // called after the old text was read and the new text planned, before the file is read again
  readonly afterRead?: (path: string) => void;
}

export type InstalledFileResult =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'written'; readonly backup: string | null }
  | { readonly kind: 'changed' };

// Writes the planned text over the file through a temporary file and a rename, onto a link's
// target so the link survives, after it copies the old bytes and mode to `<file>.www-backup`. A
// change between the read and the rename plans again once, then reports `changed`.
export function writeInstalledFile(
  request: InstalledFileRequest,
  seam: InstallWriteSeam,
): InstalledFileResult {
  const target = existsSync(request.path) ? realpathSync(request.path) : request.path;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = readTextOrNull(target);
    const after = request.plan(before);

    if (after === null || after === before) {
      return { kind: 'unchanged' };
    }

    seam.afterRead?.(request.path);

    if (readTextOrNull(target) === before) {
      return {
        kind: 'written',
        backup: replaceFile(target, after, request.newMode, before !== null),
      };
    }
  }

  return { kind: 'changed' };
}

function replaceFile(
  target: string,
  text: string,
  newMode: number,
  isReplacing: boolean,
): string | null {
  mkdirSync(dirname(target), { recursive: true });

  const mode = isReplacing ? statSync(target).mode % 0o1000 : newMode;
  const backup = isReplacing ? `${target}.www-backup` : null;

  if (backup !== null) {
    copyFileSync(target, backup);
    chmodSync(backup, mode);
  }

  writeFileAtomic(target, text, mode);

  return backup;
}
