import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { HandKeptFiles } from '../import/parse-hand-kept-store.ts';
import { ownerHeader, prsHeader } from './constants.ts';
import { createImportFiles } from './create-import-files.ts';
import type { ImportFiles } from './types.ts';

export interface ConvertedFiles {
  readonly session: string;
  readonly items: string;
  readonly journal: string;
}

export interface ImportWrite {
  readonly originals: HandKeptFiles;
  readonly converted: ConvertedFiles;
}

// Runs only inside the lock. It changes no hand-kept file until import-backup/ is complete and
// every new file is written to a temporary file. `session` is renamed last, so a store that still
// says 0-by-hand has not finished importing.
export function writeImportFiles(
  folder: string,
  write: ImportWrite,
  files: ImportFiles = createImportFiles(),
): void {
  const backupPath = join(folder, 'import-backup');

  if (!files.exists(backupPath)) {
    writeBackup(folder, backupPath, write.originals, files);
  }

  const newFiles = [
    ...(files.exists(join(folder, 'owner.tsv'))
      ? []
      : [{ name: 'owner.tsv', text: `${ownerHeader}\n` }]),
    ...(files.exists(join(folder, 'prs.tsv')) ? [] : [{ name: 'prs.tsv', text: `${prsHeader}\n` }]),
    { name: 'items.tsv', text: write.converted.items },
    { name: 'journal.tsv', text: write.converted.journal },
    { name: 'session', text: write.converted.session },
  ].map((file) => {
    const path = join(folder, file.name);

    return {
      text: file.text,
      path,
      temporaryPath: `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`,
    };
  });

  for (const file of newFiles) {
    files.writeFile(file.temporaryPath, file.text);
  }

  for (const file of newFiles) {
    files.rename(file.temporaryPath, file.path);
  }
}

// An import that stopped during its backup left a folder named import-backup.tmp-*, which holds a
// partial copy and is never used.
function writeBackup(
  folder: string,
  backupPath: string,
  originals: HandKeptFiles,
  files: ImportFiles,
): void {
  for (const name of files.list(folder)) {
    if (name.startsWith('import-backup.tmp-')) {
      files.removeFolder(join(folder, name));
    }
  }

  const temporaryPath = `${backupPath}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`;

  files.makeFolder(temporaryPath);

  const names = [
    'session',
    ...(originals.items === null ? [] : ['items.tsv']),
    ...(originals.journal === null ? [] : ['journal.tsv']),
  ];

  for (const name of names) {
    files.copyFile(join(folder, name), join(temporaryPath, name));
  }

  files.rename(temporaryPath, backupPath);
}
