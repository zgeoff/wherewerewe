import { expect, test } from 'bun:test';
import type { ImportPick } from '../import/pick-import.ts';
import { getPickedImport } from './get-picked-import.ts';

test('it returns the import that was picked', () => {
  const picked: ImportPick = {
    kind: 'import',
    session: {
      format: '1',
      name: 'old-notes',
      goal: 'Ship it',
      started: '2026-03-02T08:00:00Z',
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: null,
      lastNudge: null,
      importedFrom: '0-by-hand',
    },
    items: [],
    journal: [],
    carried: 0,
  };

  expect(getPickedImport(picked)).toStrictEqual(picked);
});

test('it throws with the problem lines when the import was refused', () => {
  const picked: ImportPick = { kind: 'refused', problems: ['session (goal): the key is missing.'] };

  expect(() => getPickedImport(picked)).toThrow(
    'the import was refused: session (goal): the key is missing.',
  );
});
