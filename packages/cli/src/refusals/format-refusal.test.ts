import { expect, test } from 'bun:test';
import { formatRefusal } from './format-refusal.ts';
import { toPlaceholder } from './to-placeholder.ts';

test('it prints the lines, then each run as a Run line', () => {
  const text = formatRefusal(
    {
      exitCode: 3,
      lines: ['www: refused: drop needs a reason.'],
      runs: [{ www: ['drop', 'p-sim', '--why', toPlaceholder('<reason>')] }],
    },
    { sessionFlag: null },
  );

  expect(text).toBe('www: refused: drop needs a reason.\nRun: www drop p-sim --why "<reason>"\n');
});

test.each([
  [
    'task',
    ['task', 't-a', toPlaceholder('<claim>')],
    'Run: www --session tide-alerts task t-a "<claim>"',
  ],
  ['the brief', [], 'Run: www --session tide-alerts'],
  [
    'a flag before the dash dash form',
    ['--pr', 'x', '--', 'task', '-a'],
    'Run: www --session tide-alerts --pr x -- task -a',
  ],
  [
    'a claim of --session after the dash dash',
    ['--note', toPlaceholder('<note>'), '--', 'task', 't-a', '--session'],
    'Run: www --session tide-alerts --note "<note>" -- task t-a --session',
  ],
])('it keeps --session on a Run line for %s', (_title, argv, expected) => {
  const text = formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: argv }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe(`www: x\n${expected}\n`);
});

test.each([
  [['init', toPlaceholder('<name>')], 'Run: www --session tide-alerts init <name>'],
  [['attach', 'tide-alerts'], 'Run: www --session tide-alerts attach tide-alerts'],
  [['detach'], 'Run: www --session tide-alerts detach'],
  [['sessions'], 'Run: www --session tide-alerts sessions'],
  [['help'], 'Run: www --session tide-alerts help'],
  [['import', 'tide-alerts'], 'Run: www --session tide-alerts import tide-alerts'],
])('it keeps --session on the run %p', (argv, expected) => {
  const text = formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: argv }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe(`www: x\n${expected}\n`);
});

test('it adds no --session to a run that already names one', () => {
  const text = formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: ['--session', 'other', 'task', 't-a'] }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe('www: x\nRun: www --session other task t-a\n');
});

test('it prints a shell run as it is', () => {
  const text = formatRefusal(
    {
      exitCode: 5,
      lines: ['www: x'],
      runs: [{ shell: ['bun', 'add', '-g', '@wherewerewe/cli@latest'] }],
    },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe('www: x\nRun: bun add -g @wherewerewe/cli@latest\n');
});

test('it redacts a --session value that looks like a credential', () => {
  const text = formatRefusal(
    { exitCode: 2, lines: ['www: --goal needs a value.'], runs: [{ www: ['help'] }] },
    { sessionFlag: ['xoxb', '-', '12'].join('') },
  );

  expect(text).toBe(
    'www: --goal needs a value.\nRun: www --session "<where the secret lives>" help\n',
  );
});

test('it adds no second --session to a Run line that holds --session=<name>', () => {
  const text = formatRefusal(
    { exitCode: 2, lines: ['www: x'], runs: [{ www: ['--session=tide-alerts', 'goal', 'x'] }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe('www: x\nRun: www --session=tide-alerts goal x\n');
});

test.each([
  ['a line feed', '\n'],
  ['a carriage return and a line feed', '\r\n'],
  ['a vertical tab', '\v'],
  ['a form feed', '\f'],
  ['a next-line character', '\u0085'],
  ['a Unicode line separator', '\u2028'],
  ['a Unicode paragraph separator', '\u2029'],
])(
  'it prints each Run line as one output line, with %s in a value, the session or a shell word',
  (_title, lineBreak) => {
    const text = formatRefusal(
      {
        exitCode: 3,
        lines: ['www: x'],
        runs: [
          { www: ['task', 't-a', `two${lineBreak}lines`, '--', `-a${lineBreak}b`] },
          { shell: ['less', `/srv/first${lineBreak}second/session`] },
        ],
      },
      { sessionFlag: `tide${lineBreak}alerts` },
    );

    expect(text.split(/\r\n|[\n\v\f\r\u0085\u2028\u2029]/u)).toHaveLength(4);
  },
);

test('it prints a shell word that the credential test matches as the quoted placeholder', () => {
  const text = formatRefusal(
    {
      exitCode: 3,
      lines: ['www: x'],
      runs: [{ shell: ['less', ['/srv/gh', 'p_demo/session'].join('')] }],
    },
    { sessionFlag: null },
  );

  expect(text).toBe('www: x\nRun: less "<where the secret lives>"\n');
});
