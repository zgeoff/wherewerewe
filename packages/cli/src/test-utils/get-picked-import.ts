import type { ImportPick } from '../import/pick-import.ts';

export function getPickedImport(picked: ImportPick): Extract<ImportPick, { kind: 'import' }> {
  if (picked.kind === 'refused') {
    throw new Error(`the import was refused: ${picked.problems.join(' ')}`);
  }

  return picked;
}
