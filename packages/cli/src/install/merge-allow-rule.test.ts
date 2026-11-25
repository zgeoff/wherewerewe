import { expect, test } from 'bun:test';
import { isSubsequence } from '../test-utils/is-subsequence.ts';
import { parseSettingsJson } from '../test-utils/parse-settings-json.ts';
import { mergeAllowRule } from './merge-allow-rule.ts';

function setupTest() {
  return { merge: (text: string | null) => mergeAllowRule(text, 'Bash(www *)') };
}

test('it makes a new file with the rule for a missing file', () => {
  const ctx = setupTest();

  expect(ctx.merge(null)).toStrictEqual({
    kind: 'merged',
    text: '{\n  "permissions": {\n    "allow": [\n      "Bash(www *)"\n    ]\n  }\n}\n',
    isAdded: true,
  });
});

test.each([
  { title: 'no permissions key', text: '{\n  "model": "opus"\n}\n' },
  { title: 'permissions with no allow', text: '{"permissions": {"deny": ["Read(.env)"]}, "x": 1}' },
  {
    title: 'an allow with other rules',
    text: '{\n  "permissions": {\n    "allow": [\n      "Bash(git status)"\n    ],\n    "ask": ["Bash(rm *)"]\n  }\n}\n',
  },
])('it adds the rule to a file with $title and keeps every other byte', (row) => {
  const ctx = setupTest();
  const merge = ctx.merge(row.text);

  expect({
    isAdded: merge.kind === 'merged' && merge.isAdded,
    isKept: merge.kind === 'merged' && isSubsequence(row.text, merge.text),
    holdsRule:
      merge.kind === 'merged' &&
      parseSettingsJson(merge.text).permissions.allow?.includes('Bash(www *)'),
  }).toStrictEqual({ isAdded: true, isKept: true, holdsRule: true });
});

test('it adds the rule once and changes no byte on a second run', () => {
  const ctx = setupTest();
  const first = ctx.merge('{"a": 1}');
  const text = first.kind === 'merged' ? first.text : '';

  expect(ctx.merge(text)).toStrictEqual({ kind: 'merged', text, isAdded: false });
});

test('it writes no deny or ask rule', () => {
  const ctx = setupTest();
  const merge = ctx.merge('{}');

  const keys =
    merge.kind === 'merged' ? Object.keys(parseSettingsJson(merge.text).permissions) : [];

  expect(keys).toStrictEqual(['allow']);
});

test.each([
  { title: 'a comment', text: '{ /* c */ }' },
  { title: 'permissions as a list', text: '{"permissions": []}' },
  { title: 'allow as an object', text: '{"permissions": {"allow": {}}}' },
  { title: 'a top level list', text: '[1]' },
])('it reads $title as unreadable', (row) => {
  const ctx = setupTest();

  expect(ctx.merge(row.text)).toStrictEqual({ kind: 'unreadable' });
});

test('it adds the rule to the later permissions of a file that has the key twice', () => {
  const ctx = setupTest();
  const merge = ctx.merge('{"permissions":{"allow":[]},"permissions":{"allow":[]}}');

  expect({
    isAdded: merge.kind === 'merged' && merge.isAdded,
    allow: merge.kind === 'merged' ? parseSettingsJson(merge.text).permissions.allow : null,
  }).toStrictEqual({ isAdded: true, allow: ['Bash(www *)'] });
});
