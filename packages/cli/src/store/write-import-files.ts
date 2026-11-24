import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import type { HandKeptFiles } from '../import/parse-hand-kept-store.ts';
import { notesHeader, ownerHeader, prsHeader } from './constants.ts';
import { createImportFiles } from './create-import-files.ts';
import type { ImportFiles } from './types.ts';

interface ConvertedFiles {
  readonly session: string;
  readonly items: string;
  readonly journal: string;
}

export interface ImportWrite {
  readonly originals: HandKeptFiles;
  readonly converted: ConvertedFiles;
}

export function writeImportFiles(
  folder: string,
  write: ImportWrite,
  files: ImportFiles = createImportFiles(),
): void {
  removeLeftovers(folder, files);

  const backupPath = join(folder, 'import-backup');

  if (!files.exists(backupPath)) {
    writeBackup(folder, backupPath, write.originals, files);
  }

  const sessionMode = files.readMode(join(folder, 'session'));

  const newFiles = [
    { name: 'owner.tsv', text: `${ownerHeader}\n` },
    { name: 'prs.tsv', text: `${prsHeader}\n` },
    { name: 'notes.tsv', text: `${notesHeader}\n` },
    { name: 'items.tsv', text: write.converted.items },
    { name: 'journal.tsv', text: write.converted.journal },
    { name: 'session', text: write.converted.session },
  ].flatMap((file) => {
    const path = join(folder, file.name);
    const isKept = files.exists(path);

    return isKept &&
      (file.name === 'owner.tsv' || file.name === 'prs.tsv' || file.name === 'notes.tsv')
      ? []
      : [
          {
            text: file.text,
            path,
            mode: isKept ? files.readMode(path) : sessionMode,
            temporaryPath: `${path}.tmp-${String(process.pid)}-${randomBytes(4).toString('hex')}`,
          },
        ];
  });

  for (const file of newFiles) {
    files.writeFile(file.temporaryPath, file.text, file.mode);
  }

  for (const file of newFiles) {
    files.rename(file.temporaryPath, file.path);
  }
}

const stagedFile = /^(?:owner\.tsv|prs\.tsv|notes\.tsv|items\.tsv|journal\.tsv|session)\.tmp-/u;

function removeLeftovers(folder: string, files: ImportFiles): void {
  for (const name of files.list(folder)) {
    if (name.startsWith('import-backup.tmp-')) {
      files.removeFolder(join(folder, name));
    } else if (stagedFile.test(name)) {
      files.removeFile(join(folder, name));
    }
  }
}

function writeBackup(
  folder: string,
  backupPath: string,
  originals: HandKeptFiles,
  files: ImportFiles,
): void {
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
