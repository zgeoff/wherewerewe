import { expect, test } from 'bun:test';
import { quoteShellWord } from './quote-shell-word.ts';

test.each([
  ['plain', 'plain'],
  ['/srv/app#1', '/srv/app#1'],
  ['', '""'],
  ['two words', '"two words"'],
  ['phase>draft', '"phase>draft"'],
  ['a<b', '"a<b"'],
  ['#note', '"#note"'],
  ['a;b', '"a;b"'],
  ['a|b&c', '"a|b&c"'],
  ['say "hi"', String.raw`"say \"hi\""`],
  ['$HOME `x` \\', String.raw`"\$HOME \`x\` \\"`],
  ["it's", `"it's"`],
  ['done!', "'done!'"],
  ["it's done!", String.raw`'it'\''s done!'`],
  ['line\nbreak', '"line\nbreak"'],
])('it writes %p as %s', (word, expected) => {
  expect(quoteShellWord(word)).toBe(expected);
});
