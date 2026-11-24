import { expect, test } from 'bun:test';
import { toThreeByte } from './to-three-byte.ts';

function setupTest() {
  return { convert: toThreeByte };
}

test('it turns each character but a space into a 3-byte character', () => {
  const ctx = setupTest();

  expect(ctx.convert('ab c')).toBe('語語 語');
});
