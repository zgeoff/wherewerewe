import { expect, test } from 'bun:test';
import { readShellWords } from '../test-utils/read-shell-words.ts';
import { formatCommandLine } from './format-command-line.ts';
import { toPlaceholder } from './to-placeholder.ts';

test.each([
  [['help'], 'www help'],
  [['attach', toPlaceholder('<name>')], 'www attach <name>'],
  [
    ['task', 't-e2e', toPlaceholder('<claim of at most 120 characters>')],
    'www task t-e2e "<claim of at most 120 characters>"',
  ],
  [['task', toPlaceholder('<new id>'), toPlaceholder('<claim>')], 'www task <new id> "<claim>"'],
  [
    ['done', 't-a', '--evidence', toPlaceholder('<PR, commit or test run>')],
    'www done t-a --evidence "<PR, commit or test run>"',
  ],
  [['task', 't-a', ''], 'www task t-a ""'],
  [['task', 't-a', 'say "hi" $HOME `x` \\'], String.raw`www task t-a "say \"hi\" \$HOME \`x\` \\"`],
  [['task', 't-a', 'a;b'], 'www task t-a "a;b"'],
  [['task', 't-a', 'plain'], 'www task t-a plain'],
  [
    ['task', 't-a', '--pr', toPlaceholder('<owner>/<repo>#<number>')],
    'www task t-a --pr <owner>/<repo>#<number>',
  ],
  [['task', 't-a', '--path', '/srv/app#1'], 'www task t-a --path /srv/app#1'],
  [['task', 't-a', 'phase>draft'], 'www task t-a "phase>draft"'],
  [['task', 't-a', '#note'], 'www task t-a "#note"'],
])('it writes %p as %s', (argv, expected) => {
  expect(formatCommandLine(argv)).toBe(expected);
});

test.each([
  [['task', 't-a', 'phase>draft']],
  [['task', 't-a', 'a < b > c']],
  [['task', 't-a', 'ship it; then rm -rf x | tee y & z']],
  [['task', 't-a', 'cost is $5 and $(date) and `date`']],
  [['task', 't-a', String.raw`back\slash and "double" and 'single'`]],
  [['task', 't-a', 'glob * ? [a-z] {1,2} ~/x']],
  [['done', 't-a', '--evidence', 'merged!']],
  [['done', 't-a', '--evidence', "it's merged!"]],
  [['task', 't-a', '']],
  [['task', 't-a', '#not a comment']],
  [['task', 't-a', 'two\nlines']],
  [['where', 'wt-a', 'x', '--path', '/tmp/two words/(a)/repo']],
])('it prints %p as words that a real shell reads back as typed', async (argv) => {
  const words = await readShellWords(formatCommandLine(argv).slice('www '.length));

  expect(words).toStrictEqual(argv);
});

test('it quotes a value that reads like a placeholder', async () => {
  const argv = ['task', 't-a', '<name>', '--pr', 'acme/tool#1'];
  const line = formatCommandLine(argv);

  const words = await readShellWords(line.slice('www '.length));

  expect({ line, words }).toStrictEqual({
    line: 'www task t-a "<name>" --pr acme/tool#1',
    words: argv,
  });
});

test.each([
  ['a line feed', 'two\nlines'],
  ['a carriage return', 'two\rlines'],
  ['a next-line character', 'two\u0085lines'],
  ['a Unicode line separator', 'two\u2028lines'],
  ['a Unicode paragraph separator', 'two\u2029lines'],
  ['a vertical tab and a form feed', 'two\vline\fs'],
  ['a line break beside a quote and a backslash', "it's\n\\here"],
])('it prints a value with %s on one line that a real shell reads back', async (_title, value) => {
  const line = formatCommandLine(['task', 't-a', value]);

  const words = await readShellWords(line.slice('www '.length));

  expect({ lines: line.split(/\r\n|[\n\v\f\r\u0085\u2028\u2029]/u).length, words }).toStrictEqual({
    lines: 1,
    words: ['task', 't-a', value],
  });
});

test.each([
  ['a joined flag', ['task', 't-a', '--', '--may=-keep']],
  ['a flag and its value', ['task', 't-a', '--', '--never', '-keep']],
])('it prints %s after -- as typed', async (_title, argv) => {
  const line = formatCommandLine(argv);

  const words = await readShellWords(line.slice('www '.length));

  expect({ line, words }).toStrictEqual({ line: `www ${argv.join(' ')}`, words: argv });
});
