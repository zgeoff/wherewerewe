import { expect, test } from 'bun:test';
import { renderGrantBullets } from './render-grant-bullets.ts';

test('it prints each group under its label, one may and not bullet a line', () => {
  expect(
    renderGrantBullets({
      may: ['water the beds before 08:00', 'mow the lawn'],
      not: ['prune the apple tree'],
      never: ['dig up the roses'],
      scope: null,
    }),
  ).toStrictEqual([
    '  may    • water the beds before 08:00',
    '         • mow the lawn',
    '  not    • prune the apple tree',
    '  never  • dig up the roses',
  ]);
});

test('it leaves out a group with no bullets', () => {
  expect(
    renderGrantBullets({ may: ['water the beds'], not: [], never: [], scope: null }),
  ).toStrictEqual(['  may    • water the beds']);
});

test('it puts short never bullets on one line while it fits in 100 characters', () => {
  expect(
    renderGrantBullets({
      may: ['water the beds'],
      not: [],
      never: ['dig up the roses', 'spray the hives', 'a'.repeat(30), 'b'.repeat(40)],
      scope: null,
    }),
  ).toStrictEqual([
    '  may    • water the beds',
    `  never  • dig up the roses  • spray the hives  • ${'a'.repeat(30)}`,
    `         • ${'b'.repeat(40)}`,
  ]);
});

test('it wraps a long bullet under its own text, and starts the next never bullet on a new line', () => {
  const long = `${'x'.repeat(80)} ${'y'.repeat(30)}`;

  expect(
    renderGrantBullets({ may: [long], not: [], never: [long, 'spray the hives'], scope: null }),
  ).toStrictEqual([
    `  may    • ${'x'.repeat(80)}`,
    `           ${'y'.repeat(30)}`,
    `  never  • ${'x'.repeat(80)}`,
    `           ${'y'.repeat(30)}`,
    '         • spray the hives',
  ]);
});

test('it gives a never bullet that holds a • a line of its own', () => {
  expect(
    renderGrantBullets({
      may: ['water the beds'],
      not: [],
      never: ['dig up the roses', 'spray • the hives', 'mow the meadow'],
      scope: null,
    }),
  ).toStrictEqual([
    '  may    • water the beds',
    '  never  • dig up the roses',
    '         • spray • the hives',
    '         • mow the meadow',
  ]);
});
