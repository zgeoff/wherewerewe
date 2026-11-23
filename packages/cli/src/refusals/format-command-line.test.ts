import { expect, test } from 'bun:test';
import { formatCommandLine } from './format-command-line.ts';

test.each([
  [['help'], 'www help'],
  [['attach', '<name>'], 'www attach <name>'],
  [
    ['task', 't-e2e', '<claim of at most 120 characters>'],
    'www task t-e2e "<claim of at most 120 characters>"',
  ],
  [['task', '<new id>', '<claim>'], 'www task <new id> "<claim>"'],
  [
    ['done', 't-a', '--evidence', '<PR, commit or test run>'],
    'www done t-a --evidence "<PR, commit or test run>"',
  ],
  [['task', 't-a', ''], 'www task t-a ""'],
  [['task', 't-a', 'say "hi" $HOME `x` \\'], String.raw`www task t-a "say \"hi\" \$HOME \`x\` \\"`],
  [['task', 't-a', 'a;b'], 'www task t-a "a;b"'],
  [['task', 't-a', 'plain'], 'www task t-a plain'],
  [['task', 't-a', '--pr', '<owner>/<repo>#<number>'], 'www task t-a --pr <owner>/<repo>#<number>'],
  [['task', 't-a', '--path', '/srv/app#1'], 'www task t-a --path /srv/app#1'],
])('it writes %p as %s', (argv, expected) => {
  expect(formatCommandLine(argv)).toBe(expected);
});
