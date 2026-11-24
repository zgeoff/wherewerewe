import { expect, test } from 'bun:test';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { countGrantLines } from './count-grant-lines.ts';

test('it counts 12 one-line bullets as 12 lines', () => {
  expect(
    countGrantLines({
      may: Array.from({ length: 12 }, () => 'water'),
      not: [],
      never: [],
      scope: null,
    }),
  ).toBe(12);
});

test('it counts one bullet of 162 characters of spaced words as 2 lines', () => {
  expect(countGrantLines({ may: [buildSpacedText(162)], not: [], never: [], scope: null })).toBe(2);
});

test('it counts a bullet of 649 characters in words of 74 and 11 one-character bullets as 20 lines', () => {
  expect(
    countGrantLines({
      may: [buildSpacedText(649, 74), ...Array.from({ length: 11 }, () => 'o')],
      not: [],
      never: [],
      scope: null,
    }),
  ).toBe(20);
});

test('it counts no bullets as no lines', () => {
  expect(countGrantLines({ may: [], not: [], never: [], scope: 'in garden-api' })).toBe(0);
});
