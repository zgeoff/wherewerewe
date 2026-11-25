import { expect, test } from 'bun:test';
import type { WriteResult } from '../writes/types.ts';
import { getPickedWrite } from './get-picked-write.ts';

function setupTest() {
  return { getPickedWrite };
}

test('it returns the change and the reply of a write', () => {
  const ctx = setupTest();

  const picked: WriteResult = {
    kind: 'write',
    change: { journal: [] },
    reply: (figure) => `done. Brief: ${String(figure.tokens)} of ${String(figure.limit)} tokens.`,
  };

  expect(ctx.getPickedWrite(picked, 7)).toStrictEqual({
    change: { journal: [] },
    reply: 'done. Brief: 7 of 8000 tokens.',
  });
});

test('it throws with the refusal text when the write was refused', () => {
  const ctx = setupTest();

  const picked: WriteResult = {
    kind: 'refused',
    refusal: { exitCode: 3, lines: ['www: refused: no.'], runs: [{ www: ['help'] }] },
  };

  expect(() => ctx.getPickedWrite(picked, 7)).toThrow('the write was refused: www: refused: no.');
});
