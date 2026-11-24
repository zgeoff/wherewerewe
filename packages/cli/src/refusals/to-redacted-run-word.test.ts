import { expect, test } from 'bun:test';
import { toRedactedRunWord } from './to-redacted-run-word.ts';

test.each([
  { title: 'a line feed', separator: '\n' },
  { title: 'a next line', separator: '\u0085' },
  { title: 'a line feed and an indent', separator: ' \n  ' },
])('it gives the placeholder for a credential that $title splits', (row) => {
  const split = ['ops', '_', 'a'.repeat(10), row.separator, 'b'.repeat(10)].join('');

  expect(toRedactedRunWord(split)).toStrictEqual({ placeholder: '<where the secret lives>' });
});

test('it keeps a value with a line break that holds no credential', () => {
  expect(toRedactedRunWord('rows of\n40 cm')).toBe('rows of\n40 cm');
});
