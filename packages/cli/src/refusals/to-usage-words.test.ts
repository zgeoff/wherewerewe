import { expect, test } from 'bun:test';
import { toUsageWords } from './to-usage-words.ts';

test.each([
  {
    line: 'wait <id> "<what>" --who <who> [<check>]',
    words: [
      'wait',
      { placeholder: '<id>', shape: 'id' },
      { placeholder: '<what>' },
      '--who',
      { placeholder: '<who>' },
    ],
  },
  {
    line: 'set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]',
    words: ['set', { placeholder: '<id>', shape: 'id' }],
  },
  {
    line: 'init <name> --goal "<goal>"',
    words: ['init', { placeholder: '<name>', shape: 'id' }, '--goal', { placeholder: '<goal>' }],
  },
  { line: 'ack o-<n>', words: ['ack', 'o-1'] },
  { line: '', words: [] },
])('it keeps the required words of $line', (row) => {
  expect(toUsageWords(row.line)).toStrictEqual([...row.words]);
});
