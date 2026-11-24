import { expect, test } from 'bun:test';
import { cutRedactedLine } from './cut-redacted-line.ts';

test('it cuts to 100 code points a line whose cut makes the bare name of a pattern a match at the end', () => {
  const cut = cutRedactedLine(`${'p'.repeat(93)} xoxb- and more words`);

  expect({ cut, width: cut.split(/(?:)/u).length }).toStrictEqual({
    cut: `${'p'.repeat(93)} <wher…`,
    width: 100,
  });
});

test('it leaves a line of at most 100 code points with no credential as it is', () => {
  expect(cutRedactedLine('  t-a         Write the parser')).toBe('  t-a         Write the parser');
});

test('it replaces a credential before it cuts, so no part of it stays at the cut', () => {
  const credential = ['xoxb', '-', '12345'].join('');

  expect(cutRedactedLine(`${'p'.repeat(95)} ${credential} tail`)).toBe(`${'p'.repeat(95)} <wh…`);
});
