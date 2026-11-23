import { expect, test } from 'bun:test';
import { readShellWords } from './read-shell-words.ts';

test.each([
  ['task t-a plain', ['task', 't-a', 'plain']],
  ['task t-a "two words"', ['task', 't-a', 'two words']],
  ["task t-a 'phase>draft'", ['task', 't-a', 'phase>draft']],
  [String.raw`task t-a "say \"hi\" for \$5"`, ['task', 't-a', 'say "hi" for $5']],
  ['task t-a ""', ['task', 't-a', '']],
  [String.raw`task t-a a\ b`, ['task', 't-a', 'a b']],
])('it splits %s into the words a shell reads', async (text, words) => {
  const actual = await readShellWords(text);

  expect(actual).toStrictEqual(words);
});

test('it fails on text the shell refuses', async () => {
  await expect(readShellWords('task "open')).toReject();
});
