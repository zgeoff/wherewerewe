import { expect, test } from 'bun:test';
import { findJSONMember } from './find-json-member.ts';
import { parseJSONSpans } from './parse-json-spans.ts';

function setupTest() {
  return {
    read: (text: string, key: string) => {
      const found = findJSONMember(parseJSONSpans(text), key);

      return found === undefined ? null : text.slice(found.start, found.end);
    },
  };
}

test('it finds the value of a key', () => {
  const ctx = setupTest();

  expect(ctx.read('{"a": 1, "b": [2]}', 'b')).toBe('[2]');
});

test('it finds the later value of a key that appears twice, as JSON.parse reads it', () => {
  const ctx = setupTest();

  expect(ctx.read('{"a": 1, "a": 2}', 'a')).toBe('2');
});

test('it finds nothing for a missing key or a value that is no object', () => {
  const ctx = setupTest();

  expect([ctx.read('{"a": 1}', 'b'), ctx.read('[1]', 'a')]).toStrictEqual([null, null]);
});
