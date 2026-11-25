import { existsSync, mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname } from 'node:path';
import { writeFileAtomic } from '../store/write-file-atomic.ts';
import { readTextOrNull } from './read-text-or-null.ts';
import type { FilePlan } from './types.ts';

export interface InstalledFileRequest {
  readonly path: string;

  // the mode of a file that does not exist yet; an existing file keeps its own
  readonly newMode: number;

  // what the file becomes for its old text, or a refusal
  readonly plan: (before: string | null) => FilePlan;

  // called with the plan just before the file is backed up and written, never for an unchanged file
  readonly announce?: (plan: FilePlan) => void;
}

export interface InstallWriteSeam {
  // called after the backup and the replacement are written, just before the file is read for the
  // last time and the rename
  readonly beforeRename?: (path: string) => void;
}

export type InstalledFileResult =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'written'; readonly backup: string | null }
  | { readonly kind: 'changed' }
  | { readonly kind: 'refused' };

// Writes the planned text over the file through a temporary file and a rename, onto a link's
// target, after it copies the old bytes to `<file>.www-backup`. It reads the file again just before
// the rename, and when it differs from what was planned from, plans again once, then reports it.
export function writeInstalledFile(
  request: InstalledFileRequest,
  seam: InstallWriteSeam,
): InstalledFileResult {
  const target = existsSync(request.path) ? realpathSync(request.path) : request.path;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = readTextOrNull(target);
    const plan = request.plan(before);

    if (plan.kind === 'refused') {
      return { kind: 'refused' };
    }

    if (plan.text === before) {
      return { kind: 'unchanged' };
    }

    if (attempt === 0) {
      request.announce?.(plan);
    }

    const written = replaceFile(target, plan.text, {
      before,
      newMode: request.newMode,
      probeUnchangedSincePlan: () => {
        seam.beforeRename?.(request.path);

        return readTextOrNull(target) === before;
      },
    });

    if (written !== null) {
      return { kind: 'written', backup: written.backup };
    }
  }

  return { kind: 'changed' };
}

interface Replacement {
  readonly before: string | null;
  readonly newMode: number;
  readonly probeUnchangedSincePlan: () => boolean;
}

function replaceFile(
  target: string,
  text: string,
  replacement: Replacement,
): { readonly backup: string | null } | null {
  const before = replacement.before;

  mkdirSync(dirname(target), { recursive: true });

  const mode = before === null ? replacement.newMode : statSync(target).mode % 0o1000;
  const backup = before === null ? null : `${target}.www-backup`;

  if (backup !== null && before !== null) {
    // a temporary file renamed over the backup path replaces a link there, and never follows it
    writeFileAtomic(backup, before, mode);
  }

  const isWritten = writeFileAtomic(target, text, mode, {
    isStillValid: replacement.probeUnchangedSincePlan,
  });

  return isWritten ? { backup } : null;
}
