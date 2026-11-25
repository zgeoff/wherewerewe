import { expect, test } from 'bun:test';
import { isBriefCommand } from './is-brief-command.ts';

function setupTest() {
  return { isBriefCommand };
}

test.each([
  { command: 'www', expected: true },
  { command: '  wherewerewe  ', expected: true },
  { command: 'www --session tide', expected: true },
  { command: '/home/kim/.local/bin/www', expected: true },
  { command: "/bin/zsh -lc 'www'", expected: true },
  { command: 'bash -c "www"', expected: true },
  { command: 'www rows', expected: false },
  { command: 'www && rm -rf build', expected: false },
  { command: 'www | head', expected: false },
  { command: 'echo www', expected: false },
  { command: 'www task "x"', expected: false },
])('it reads $command as the brief command: $expected', (row) => {
  const ctx = setupTest();

  expect(ctx.isBriefCommand(row.command)).toBe(row.expected);
});
