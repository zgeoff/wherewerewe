import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { createImportFiles } from './create-import-files.ts';
import type { ImportFiles } from './types.ts';

export interface UpgradeWrite {
  // the whole new files: the journal is the format 1 rows, then the new ones
  readonly session: string;
  readonly items: string;
  readonly notes: string;
  readonly journal: string;
}

// Copies the format 1 files into `format-1-backup/` when it does not exist, then writes the new
// files through temporary files. `session` is renamed last, so its rename makes the store format 2:
// a stop leaves no backup or a whole one, and a rerun starts again from the backup.
export function writeUpgradeFiles(
  folder: string,
  write: UpgradeWrite,
  files: ImportFiles = createImportFiles(),
): void {
  removeLeftovers(folder, files);

  const backupPath = join(folder, 'format-1-backup');

  if (!files.exists(backupPath)) {
    writeBackup(folder, backupPath, files);
  }

  const sessionMode = files.readMode(join(folder, 'session'));

  const staged = [
    { name: 'journal.tsv', text: write.journal },
    { name: 'items.tsv', text: write.items },
    { name: 'notes.tsv', text: write.notes },
    { name: 'session', text: write.session },
  ].map((file) => {
    const path = join(folder, file.name);

    return {
      text: file.text,
      path,
      mode: files.exists(path) ? files.readMode(path) : sessionMode,
      temporaryPath: `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`,
    };
  });

  for (const file of staged) {
    files.writeFile(file.temporaryPath, file.text, file.mode);
  }

  for (const file of staged) {
    files.rename(file.temporaryPath, file.path);
  }
}

const stagedFile = /^(?:session|items\.tsv|notes\.tsv|journal\.tsv)\.tmp-/u;

function removeLeftovers(folder: string, files: ImportFiles): void {
  for (const name of files.list(folder)) {
    if (name.startsWith('format-1-backup.tmp-')) {
      files.removeFolder(join(folder, name));
    } else if (stagedFile.test(name)) {
      files.removeFile(join(folder, name));
    }
  }
}

function writeBackup(folder: string, backupPath: string, files: ImportFiles): void {
  const temporaryPath = `${backupPath}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;

  files.makeFolder(temporaryPath);

  const names = ['session', 'items.tsv', 'notes.tsv', 'journal.tsv'].filter(
    (name) => name === 'session' || files.exists(join(folder, name)),
  );

  for (const name of names) {
    files.copyFile(join(folder, name), join(temporaryPath, name));
  }

  files.rename(temporaryPath, backupPath);
}
