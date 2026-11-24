import { expect, test } from 'bun:test';
import { normaliseWords } from './normalise-words.ts';

test.each([
  ['a line feed', 'Merge it\nyourself.', 'Merge it yourself.'],
  ['a carriage return and a line feed', 'Merge it\r\nyourself.', 'Merge it yourself.'],
  ['a lone carriage return', 'Merge it\ryourself.', 'Merge it yourself.'],
  ['two line feeds in a row', 'Merge it\n\nyourself.', 'Merge it  yourself.'],
  ['no line break', 'Merge it yourself.', 'Merge it yourself.'],
])('it turns %s into one space', (_title, words, expected) => {
  expect(normaliseWords(words)).toBe(expected);
});

test('it leaves a tab alone, so the text rules still refuse it', () => {
  expect(normaliseWords('Merge\tit')).toBe('Merge\tit');
});
