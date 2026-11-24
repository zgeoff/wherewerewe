import { expect, test } from 'bun:test';
import { joinSplitLines } from './join-split-lines.ts';

test.each([
  { title: 'a line feed', text: 'ab\ncd', joined: 'abcd' },
  { title: 'a carriage return and line feed', text: 'ab\r\ncd', joined: 'abcd' },
  { title: 'a next line', text: 'ab\u0085cd', joined: 'abcd' },
  { title: 'a line break with spaces and a tab around it', text: 'ab \n\t cd', joined: 'abcd' },
  { title: 'no line break', text: 'ab cd', joined: 'ab cd' },
])('it joins $title', (row) => {
  expect(joinSplitLines(row.text)).toBe(row.joined);
});
