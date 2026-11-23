import { expect, test } from 'bun:test';
import { formatRefusal } from './format-refusal.ts';

test('it prints the lines, then each run as a Run line', () => {
  const text = formatRefusal(
    {
      exitCode: 3,
      lines: ['www: refused: drop needs a reason.'],
      runs: [{ www: ['drop', 'p-sim', '--why', '<reason>'] }],
    },
    { sessionFlag: null },
  );

  expect(text).toBe('www: refused: drop needs a reason.\nRun: www drop p-sim --why "<reason>"\n');
});

test.each([
  ['task', ['task', 't-a', '<claim>'], 'Run: www --session tide-alerts task t-a "<claim>"'],
  ['the brief', [], 'Run: www --session tide-alerts'],
  [
    'a flag before the dash dash form',
    ['--pr', 'x', '--', 'task', '-a'],
    'Run: www --session tide-alerts --pr x -- task -a',
  ],
])('it keeps --session on a Run line for %s', (_title, argv, expected) => {
  const text = formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: argv }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe(`www: x\n${expected}\n`);
});

test.each([
  [['init', '<name>']],
  [['attach', 'tide-alerts']],
  [['detach']],
  [['sessions']],
  [['help']],
  [['import', 'tide-alerts']],
  [['--session', 'other', 'task', 't-a']],
])('it adds no --session to the run %p', (argv) => {
  const text = formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: argv }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text.includes('--session tide-alerts')).toBe(false);
});

test('it prints a shell run as it is', () => {
  const text = formatRefusal(
    { exitCode: 5, lines: ['www: x'], runs: [{ shell: 'bun add -g @wherewerewe/cli@latest' }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe('www: x\nRun: bun add -g @wherewerewe/cli@latest\n');
});
