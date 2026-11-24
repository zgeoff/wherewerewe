import { expect, test } from 'bun:test';
import { parseSourceTokens } from './parse-source-tokens.ts';

test('it leaves out line and block comments and counts the lines they span', () => {
  expect(
    parseSourceTokens('a; // x\n/* y\n z */ b;\n').map((token) => [token.value, token.line]),
  ).toStrictEqual([
    ['a', 1],
    [';', 1],
    ['b', 3],
    [';', 3],
  ]);
});

test('it reads a string as one token without its quotes, whatever the quote', () => {
  expect(
    parseSourceTokens(`"a b" 'c\\'d'`).map((token) => [token.kind, token.value]),
  ).toStrictEqual([
    ['string', 'a b'],
    ['string', "c'd"],
  ]);
});

test('it reads a regex with a quote or a slash in a class as one token', () => {
  expect(
    parseSourceTokens("const a = /it's [//]+/gu; b").map((token) => token.value),
  ).toStrictEqual(['const', 'a', '=', "/it's [//]+/gu", ';', 'b']);
});

test('it reads a division as punctuation', () => {
  expect(parseSourceTokens('a / b / c').map((token) => token.kind)).toStrictEqual([
    'word',
    'punct',
    'word',
    'punct',
    'word',
  ]);
});

test('it reads the words of a template substitution on their own lines', () => {
  expect(
    parseSourceTokens(`\`a\n\${b.c}\``).map((token) => [token.value, token.line]),
  ).toStrictEqual([
    ['`', 1],
    ['b', 2],
    ['.', 2],
    ['c', 2],
  ]);
});

test('it reads a template with no substitution as a string', () => {
  expect(parseSourceTokens('`env`').map((token) => [token.kind, token.value])).toStrictEqual([
    ['string', 'env'],
  ]);
});

test.each([
  {
    title: 'a postfix step',
    source: 'n++ / m / k',
    kinds: ['word', 'punct', 'punct', 'punct', 'word', 'punct', 'word'],
  },
  {
    title: 'a grouped value',
    source: '(a) / b / c',
    kinds: ['punct', 'word', 'punct', 'punct', 'word', 'punct', 'word'],
  },
  {
    title: 'a non-null assertion',
    source: 'a / b! / c',
    kinds: ['word', 'punct', 'word', 'punct', 'punct', 'word'],
  },
])('it reads a slash after $title as a division', (row) => {
  expect(parseSourceTokens(row.source).map((token) => token.kind)).toStrictEqual([...row.kinds]);
});

test.each([
  { title: 'the head of an if', source: 'if (ok) /a b/.test(s)' },
  { title: 'the head of a while', source: 'while (ok) /a b/.test(s)' },
  { title: 'the head of a for await', source: 'for await (const x of y) /a b/.test(s)' },
  { title: 'a block', source: '{}\n/a b/.test(s)' },
])('it reads a slash after $title as a regex', (row) => {
  expect(parseSourceTokens(row.source).map((token) => token.value)).toContain('/a b/');
});

test('it counts the escaped line break of a string as a line', () => {
  const tokens = parseSourceTokens('const s = "a\\\nb";\nconst t = 1;');

  expect(tokens.find((token) => token.value === 't')?.line).toBe(3);
});

test.each([
  { title: 'a prefix not', source: 'x = !/a b/.test(s)' },
  { title: 'a not after return', source: 'return !/a b/.test(s)' },
])('it reads a slash after $title as a regex', (row) => {
  expect(parseSourceTokens(row.source).map((token) => token.value)).toContain('/a b/');
});
