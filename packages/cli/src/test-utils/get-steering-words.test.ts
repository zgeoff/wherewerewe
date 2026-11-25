import { expect, test } from 'bun:test';
import { getSteeringWords } from './get-steering-words.ts';

function setupTest() {
  return { getSteeringWords };
}

test.each([
  { text: 'Ask the owner first', words: ['ask'] },
  { text: 'Hold back until it is green; do not merge', words: ['hold back', 'do not'] },
  { text: "Only when CI is green, don't push", words: ['only when', "don't"] },
  { text: 'Drop one, or replace one with www lesson.', words: [] },
  { text: 'Task lists, tasks and asked', words: [] },
])('it finds $words in $text', (row) => {
  const ctx = setupTest();

  expect(ctx.getSteeringWords(row.text)).toStrictEqual([...row.words]);
});
