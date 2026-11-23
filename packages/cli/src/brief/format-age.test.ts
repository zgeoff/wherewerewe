import { expect, test } from 'bun:test';
import { formatAge } from './format-age.ts';

test.each([
  [0, '0m'],
  [59 * 60_000, '59m'],
  [60 * 60_000, '1h'],
  [47 * 3_600_000, '47h'],
  [48 * 3_600_000, '2d'],
  [3 * 86_400_000 + 5 * 3_600_000, '3d'],
  [-5000, '0m'],
])('it formats %p ms as %s', (ageMs, expected) => {
  expect(formatAge(ageMs)).toBe(expected);
});
