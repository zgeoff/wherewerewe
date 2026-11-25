import { expect, test } from 'bun:test';
import { buildShellReplayLine } from './build-shell-replay-line.ts';

function setupTest() {
  return { buildShellReplayLine };
}

test.each([
  {
    title: 'a bare placeholder',
    text: 'www drop <id> --why "<reason>"',
    expected: 'www drop zz-a --why "<reason>"',
  },
  {
    title: 'a choice',
    text: 'www list <tasks|waits|prs>',
    expected: 'www list tasks',
  },
  {
    title: 'nested optional groups',
    text: 'www now <id> "<next step>" [--note "<detail>" [--owed]]  # nothing was written',
    expected: 'www now zz-a "<next step>"   # nothing was written',
  },
  {
    title: 'placeholders inside one word',
    text: 'www task t-a --pr <owner>/<repo>#<number>',
    expected: 'www task t-a --pr zz-a/zz-a#zz-a',
  },
  {
    title: 'quoted text that holds brackets and angle brackets',
    text: `www --session "a[b] <c> \\"d\\"" --x 'e<f>[g]' $'h\\'<i>' j\\<k`,
    expected: `www --session "a[b] <c> \\"d\\"" --x 'e<f>[g]' $'h\\'<i>' j\\<k`,
  },
])('it fills and drops only the unquoted parts of $title', (row) => {
  const ctx = setupTest();

  expect(ctx.buildShellReplayLine(row.text)).toBe(row.expected);
});

test.each([
  {
    title: 'a single quote',
    text: "www --session it's now <id>",
    expected: "www --session it's now <id>",
  },
  { title: 'an angle bracket', text: 'www now <id', expected: 'www now zz-a' },
])('it ends the text at a $title that nothing closes', (row) => {
  const ctx = setupTest();

  expect(ctx.buildShellReplayLine(row.text)).toBe(row.expected);
});
