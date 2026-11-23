import { expect, test } from 'bun:test';
import { parseRunLine } from './parse-run-line.ts';

test.each([
  ['Run: www help', ['help']],
  ['Run: www', []],
  [
    'Run: www task t-e2e "<claim of at most 120 characters>"',
    ['task', 't-e2e', '<claim of at most 120 characters>'],
  ],
  ['Run: www task <new id> "<claim>"', ['task', '<new id>', '<claim>']],
  [
    String.raw`Run: www task t-a "say \"hi\" for \$5 \\ now"`,
    ['task', 't-a', String.raw`say "hi" for $5 \ now`],
  ],
  [
    'Run: www task t-a "<claim>" --pr <owner>/<repo>#<number>',
    ['task', 't-a', '<claim>', '--pr', '<owner>/<repo>#<number>'],
  ],
  ['Run: www --session tide-alerts', ['--session', 'tide-alerts']],
  ["Run: www done t-a --evidence 'merged!'", ['done', 't-a', '--evidence', 'merged!']],
  [String.raw`Run: www task t-a 'it'\''s here!'`, ['task', 't-a', "it's here!"]],
  [String.raw`Run: www task t-a a\ b`, ['task', 't-a', 'a b']],
])('it splits %s into its words', (line, words) => {
  expect(parseRunLine(line)).toStrictEqual(words);
});

test('it throws on a shell line', () => {
  expect(() => parseRunLine('Run: bun add -g @wherewerewe/cli@latest')).toThrow(
    'not a www run line',
  );
});
