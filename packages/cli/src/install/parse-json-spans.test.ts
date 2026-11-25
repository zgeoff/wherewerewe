import { expect, test } from 'bun:test';
import { parseJSONSpans } from './parse-json-spans.ts';
import type { JSONNode } from './parse-json-spans.ts';

function setupTest() {
  return {
    sliceOf: (text: string, node: JSONNode) => text.slice(node.start, node.end),
    parse: parseJSONSpans,
  };
}

test('it gives the span of each member value of an object', () => {
  const ctx = setupTest();
  const text = '{ "a": 1,\n  "b": [true, null, "x,]"],\n  "c": {"d": -2.5e3} }';
  const node = ctx.parse(text);

  const spans =
    node.kind === 'object'
      ? node.members.map((member) => `${member.key}=${ctx.sliceOf(text, member.value)}`)
      : [];

  expect(spans).toStrictEqual(['a=1', 'b=[true, null, "x,]"]', 'c={"d": -2.5e3}']);
});

test('it gives the span of each element of an array and of an empty container', () => {
  const ctx = setupTest();
  const text = String.raw`[ {"a": 1} , [] , {} , "q\"q" ]`;
  const node = ctx.parse(text);

  const spans =
    node.kind === 'array' ? node.elements.map((element) => ctx.sliceOf(text, element)) : [];

  expect(spans).toStrictEqual(['{"a": 1}', '[]', '{}', String.raw`"q\"q"`]);
});

test('it reads a text with leading space and a trailing line break', () => {
  const ctx = setupTest();
  const text = '\n  {"a": 1}\n';
  const node = ctx.parse(text);

  expect(ctx.sliceOf(text, node)).toBe('{"a": 1}');
});
