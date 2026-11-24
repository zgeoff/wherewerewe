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

test.each([
  { title: 'an arrow function parameter', source: 'const f = ({ A, B }) => A;' },
  { title: 'a function parameter', source: 'function f({ A, B }) { return A; }' },
  { title: 'a parameter with a default', source: 'const f = ({ A, B } = {}) => A;' },
  { title: 'an argument of a call, as an arrow parameter', source: 'run(({ A, B }) => A);' },
  { title: 'a nested pattern in a parameter', source: 'const f = ({ o: { A, B } }) => A;' },
  { title: 'a nested pattern in a declaration', source: 'const { o: { A, B } } = env;' },
  { title: 'a catch parameter', source: 'try { f(); } catch ({ A, B }) { g(); }' },
])('it collects no key from $title', (row) => {
  expect(
    [...collectObjectKeys(row.source)].filter((key) => key === 'A' || key === 'B'),
  ).toStrictEqual([]);
});

test.each([
  { title: 'a call inside an if head', source: 'if (f({ A: 1 })) { g(); }' },
  {
    title: 'a call argument that a block follows',
    source: 'for (const x of f({ A: 1 })) { g(); }',
  },
])('it collects the key of an object in $title', (row) => {
  expect([...collectObjectKeys(row.source)]).toStrictEqual(['A']);
});

test('it gives the key of an object in an array literal in a parameter default', () => {
  const source = 'function f(x = flag ? [{ CODEX_SESSION_ID: value }] : []) {}';

  expect([...collectObjectKeys(source)]).toStrictEqual(['CODEX_SESSION_ID']);
});

test('it gives no key for an array pattern parameter that a return type follows', () => {
  const source = 'function f([{ CODEX_SESSION_ID }]: any): void {}';

  expect([...collectObjectKeys(source)]).toStrictEqual([]);
});
