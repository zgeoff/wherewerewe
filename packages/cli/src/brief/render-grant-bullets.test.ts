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

test('it wraps one bullet of 700 characters with no space into 8 lines of at most 100 characters', () => {
  const lines = renderGrantBullets({ may: ['x'.repeat(700)], not: [], never: [], scope: null });

  expect({
    count: lines.length,
    widest: Math.max(...lines.map((line) => line.length)),
    last: lines.at(-1)?.trim().length,
  }).toStrictEqual({ count: 8, widest: 100, last: 77 });
});

test('it prints 12 one-word bullets on 12 lines', () => {
  expect(
    renderGrantBullets({
      may: Array.from({ length: 12 }, () => 'water'),
      not: [],
      never: [],
      scope: null,
    }),
  ).toHaveLength(12);
});

test('it prints 12 never bullets of 10 characters on 2 lines of 6 bullets', () => {
  const lines = renderGrantBullets({
    may: [],
    not: [],
    never: Array.from({ length: 12 }, () => 'n'.repeat(10)),
    scope: null,
  });

  expect({
    count: lines.length,
    widest: Math.max(...lines.map((line) => line.length)),
  }).toStrictEqual({ count: 2, widest: 91 });
});

test('it prints 12 never bullets of one character on one line of 67 characters', () => {
  const lines = renderGrantBullets({
    may: [],
    not: [],
    never: Array.from({ length: 12 }, () => 'n'),
    scope: null,
  });

  expect(lines.map((line) => line.length)).toStrictEqual([67]);
});

test('it prints 7 may bullets of 90 characters and 5 not bullets of 6 on 19 lines', () => {
  expect(
    renderGrantBullets({
      may: Array.from({ length: 7 }, () => 'm'.repeat(90)),
      not: Array.from({ length: 5 }, () => 'x'.repeat(6)),
      never: [],
      scope: 's'.repeat(40),
    }),
  ).toHaveLength(19);
});
