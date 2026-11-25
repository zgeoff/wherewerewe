import { expect, test } from 'bun:test';
import { getJSONNodeAt } from './get-json-node-at.ts';

function setupTest() {
  return { text: '{"a": {"b": [10, {"c": 1}]}}' };
}

test('it gives the node at a path of names and indexes', () => {
  const ctx = setupTest();
  const node = getJSONNodeAt(ctx.text, ['a', 'b', 1]);

  expect(ctx.text.slice(node.start, node.end)).toBe('{"c": 1}');
});

test('it throws for a path the text lacks', () => {
  const ctx = setupTest();

  expect(() => getJSONNodeAt(ctx.text, ['a', 'x'])).toThrow('no node at x');
});
