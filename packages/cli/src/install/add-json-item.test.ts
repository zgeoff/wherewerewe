import { expect, test } from 'bun:test';
import { getJSONNodeAt } from '../test-utils/get-json-node-at.ts';
import { addJSONItem } from './add-json-item.ts';

function setupTest() {
  return {
    addAt: (text: string, path: readonly (string | number)[], key: string | null, value: unknown) =>
      addJSONItem(text, getJSONNodeAt(text, path), key, value),
  };
}

test('it adds a member after the last one at the indent of the others', () => {
  const ctx = setupTest();
  const text = '{\n    "a": 1,\n    "b": [2]\n}\n';

  expect(ctx.addAt(text, [], 'c', { inner: 1 })).toBe(
    '{\n    "a": 1,\n    "b": [2],\n    "c": {\n        "inner": 1\n    }\n}\n',
  );
});

test('it adds a member to an empty object on its own lines', () => {
  const ctx = setupTest();

  expect(ctx.addAt('{}\n', [], 'hooks', ['x'])).toBe('{\n  "hooks": [\n    "x"\n  ]\n}\n');
});

test('it adds an element after the last of a multiline array and keeps what follows', () => {
  const ctx = setupTest();
  const text = '{\n  "allow": [\n    "Bash(ls)",\n    "Read"\n  ],\n  "z": 1\n}\n';

  expect(ctx.addAt(text, ['allow'], null, 'Bash(www *)')).toBe(
    '{\n  "allow": [\n    "Bash(ls)",\n    "Read",\n    "Bash(www *)"\n  ],\n  "z": 1\n}\n',
  );
});

test('it adds to a single-line object on one line', () => {
  const ctx = setupTest();

  expect(ctx.addAt('{"a": 1}', [], 'b', [1])).toBe('{"a": 1, "b": [1]}');
});

test('it adds to an empty array that sits inside a nested member', () => {
  const ctx = setupTest();
  const text = '{\n  "hooks": {\n    "Stop": []\n  }\n}\n';

  expect(ctx.addAt(text, ['hooks', 'Stop'], null, { one: 1 })).toBe(
    '{\n  "hooks": {\n    "Stop": [\n      {\n        "one": 1\n      }\n    ]\n  }\n}\n',
  );
});
