import { expect, test } from 'bun:test';
import { getKindWord } from './get-kind-word.ts';

test.each([
  ['task', 'task'],
  ['wait', 'wait'],
  ['ok', 'approval'],
  ['rule', 'rule'],
  ['where', 'where item'],
] as const)('it words the kind %s as %s', (kind, word) => {
  expect(getKindWord(kind)).toBe(word);
});
