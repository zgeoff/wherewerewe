import { expect, test } from 'bun:test';
import { collectObjectKeys } from './collect-object-keys.ts';

test.each([
  { title: 'a plain key', source: 'const e = { A: 1, B: 2 };', keys: ['A', 'B'] },
  { title: 'a quoted key', source: 'const e = { "A": 1 };', keys: ['A'] },
  { title: 'a computed key', source: 'const e = { ["A"]: 1 };', keys: ['A'] },
  { title: 'a shorthand key', source: 'const e = { A, B };', keys: ['A', 'B'] },
  { title: 'a key after a spread', source: 'const e = { ...base, A: 1 };', keys: ['A'] },
  { title: 'a key of a nested object', source: 'const e = { o: { A: 1 } };', keys: ['o', 'A'] },
])('it collects $title', (row) => {
  expect([...collectObjectKeys(row.source)]).toStrictEqual([...row.keys]);
});

test.each([
  { title: 'a string that holds the key', source: 'const s = "{A: B:";' },
  { title: 'a comment that holds the key', source: 'const e = { /* A: 1, */ x: 1 };' },
  { title: 'a destructuring pattern', source: 'const { A, B } = process.env;' },
  { title: 'a call argument', source: 'f(A, B);' },
  { title: 'an array element', source: 'const l = [A, B];' },
])('it collects no key from $title', (row) => {
  expect(
    [...collectObjectKeys(row.source)].filter((key) => key === 'A' || key === 'B'),
  ).toStrictEqual([]);
});
