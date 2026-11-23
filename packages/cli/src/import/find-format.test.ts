import { expect, test } from 'bun:test';
import { findFormat } from './find-format.ts';

test.each([
  { title: 'no format line', text: 'name=old-notes\ngoal=Ship it\n', format: null },
  { title: 'a format 1 line', text: 'format=1\nname=old-notes\n', format: '1' },
  {
    title: 'a hand-kept line in the middle',
    text: 'name=a\nformat=0-by-hand\ngoal=b\n',
    format: '0-by-hand',
  },
  {
    title: 'a line that ends in a carriage return',
    text: 'format=0-by-hand\r\nname=a\r\n',
    format: '0-by-hand',
  },
  { title: 'two format lines, the last one', text: 'format=0-by-hand\nformat=1\n', format: '1' },
])('#findFormat finds $format in $title', (row) => {
  expect(findFormat(row.text)).toBe(row.format);
});
