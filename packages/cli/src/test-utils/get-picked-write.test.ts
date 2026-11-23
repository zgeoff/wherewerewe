import { expect, test } from 'bun:test';
import type { WriteResult } from '../writes/types.ts';
import { getPickedWrite } from './get-picked-write.ts';

test('it returns the change and the reply of a write', () => {
  const picked: WriteResult = {
    kind: 'write',
    change: { journal: [] },
    reply: (briefLines) => `done. Brief: ${String(briefLines)} lines.`,
  };

  expect(getPickedWrite(picked, 7)).toStrictEqual({
    change: { journal: [] },
    reply: 'done. Brief: 7 lines.',
  });
});

test('it throws with the refusal text when the write was refused', () => {
  const picked: WriteResult = {
    kind: 'refused',
    refusal: { exitCode: 3, lines: ['www: refused: no.'], runs: [{ www: ['help'] }] },
  };

  expect(() => getPickedWrite(picked, 7)).toThrow('the write was refused: www: refused: no.');
});
