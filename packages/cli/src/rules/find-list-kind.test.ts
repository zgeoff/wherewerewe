import { expect, test } from 'bun:test';
import { findListKind } from './find-list-kind.ts';

test.each([
  { text: 'rules', kind: 'rules' },
  { text: 'prs', kind: 'prs' },
  { text: 'task', kind: null },
  { text: 'toString', kind: null },
  { text: undefined, kind: null },
])('it finds $kind for $text', (row) => {
  expect(findListKind(row.text)).toBe(row.kind);
});
