import { expect, test } from 'bun:test';
import { buildSpacedText } from './build-spaced-text.ts';

test.each([700, 200, 21, 20, 1])('it builds text of exactly %i characters', (length) => {
  expect(buildSpacedText(length)).toHaveLength(length);
});

test('it joins words of at most 20 characters with single spaces', () => {
  expect(buildSpacedText(45)).toBe(`${'g'.repeat(20)} ${'g'.repeat(20)} ${'g'.repeat(3)}`);
});
