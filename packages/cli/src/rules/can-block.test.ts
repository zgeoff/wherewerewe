import { expect, test } from 'bun:test';
import { canBlock } from './can-block.ts';

test.each([
  ['task', true],
  ['wait', true],
  ['ok', false],
  ['rule', false],
  ['where', false],
] as const)('it answers %s with %p', (kind, expected) => {
  expect(canBlock(kind)).toBe(expected);
});
