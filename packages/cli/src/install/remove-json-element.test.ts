import { expect, test } from 'bun:test';
import { parseJSONSpans } from './parse-json-spans.ts';
import { removeJSONElement } from './remove-json-element.ts';

function setupTest() {
  return {
    remove: (text: string, index: number) => removeJSONElement(text, parseJSONSpans(text), index),
  };
}

test.each([
  { index: 0, expected: '[\n  2,\n  3\n]' },
  { index: 1, expected: '[\n  1,\n  3\n]' },
  { index: 2, expected: '[\n  1,\n  2\n]' },
])('it removes element $index with its comma and nothing else', (row) => {
  const ctx = setupTest();

  expect(ctx.remove('[\n  1,\n  2,\n  3\n]', row.index)).toBe(row.expected);
});

test('it empties the array when the only element goes', () => {
  const ctx = setupTest();

  expect(ctx.remove('[ 7 ]', 0)).toBe('[]');
});

test('it changes nothing for an index that holds no element', () => {
  const ctx = setupTest();

  expect(ctx.remove('[1]', 4)).toBe('[1]');
});
