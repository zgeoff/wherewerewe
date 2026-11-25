import { expect, test } from 'bun:test';
import { getJSONNodeAt } from '../test-utils/get-json-node-at.ts';
import { replaceJSONNode } from './replace-json-node.ts';

function setupTest() {
  const text =
    '{\n  "list": [\n    {"keep": true},\n    {\n      "old": 1\n    }\n  ],\n  "z": 2\n}\n';

  return {
    replaceAt: (index: number, value: unknown) =>
      replaceJSONNode(text, getJSONNodeAt(text, ['list', index]), value),
  };
}

test('it replaces a multiline object with the new value at the same indent', () => {
  const ctx = setupTest();

  expect(ctx.replaceAt(1, { fresh: [1] })).toBe(
    '{\n  "list": [\n    {"keep": true},\n    {\n      "fresh": [\n        1\n      ]\n    }\n  ],\n  "z": 2\n}\n',
  );
});

test('it replaces a single-line object with the new value on one line', () => {
  const ctx = setupTest();

  expect(ctx.replaceAt(0, { one: 1 })).toBe(
    '{\n  "list": [\n    {"one":1},\n    {\n      "old": 1\n    }\n  ],\n  "z": 2\n}\n',
  );
});
