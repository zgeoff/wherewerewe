import { expect, test } from 'bun:test';
import { parseWWWLine } from './parse-www-line.ts';

test.each([
  ['www', []],
  ['www help', ['help']],
  [
    'www init trial-notes --goal "Ship the parser with its tests"',
    ['init', 'trial-notes', '--goal', 'Ship the parser with its tests'],
  ],
  [
    'www task t-a "say \\"hi\\" for \\$5 and \\\\ and \\`x\\`"',
    ['task', 't-a', 'say "hi" for $5 and \\ and `x`'],
  ],
  ['www task t-a ""', ['task', 't-a', '']],
  [
    'www --session trial-notes done t-a --evidence "<PR, commit or test run>"',
    ['--session', 'trial-notes', 'done', 't-a', '--evidence', '<PR, commit or test run>'],
  ],
  ['www  task   t-a  x', ['task', 't-a', 'x']],
])('it splits %s into its words', (line, words) => {
  expect(parseWWWLine(line)).toStrictEqual(words);
});

test.each([
  ['www task t-a "open', 'The line has an open quote'],
  ['task t-a x', 'The line must start with www'],
  ['', 'The line must start with www'],
])('it fails with usage for %p', (line, message) => {
  expect(() => parseWWWLine(line)).toThrow(
    expect.objectContaining({ code: 'usage', message: expect.stringContaining(message) }),
  );
});
