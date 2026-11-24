import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { formatRefusal } from './format-refusal.ts';
import { toPlaceholder } from './to-placeholder.ts';

function setupTest() {
  return { formatRefusal };
}

test('it prints the lines, then each run as a Run line', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
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
  const ctx = setupTest();

  const text = ctx.formatRefusal(
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
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: argv }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe(`www: x\n${expected}\n`);
});

test('it adds no --session to a run that already names one', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: ['--session', 'other', 'task', 't-a'] }] },
    { sessionFlag: 'tide-alerts' },
  );

  expect(text).toBe('www: x\nRun: www --session other task t-a\n');
});

test('it prints a shell run as it is', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
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
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 2, lines: ['www: --goal needs a value.'], runs: [{ www: ['help'] }] },
    { sessionFlag: ['xoxb', '-', '12'].join('') },
  );

  expect(text).toBe(
    'www: --goal needs a value.\nRun: www --session "<where the secret lives>" help\n',
  );
});

test('it adds no second --session to a Run line that holds --session=<name>', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
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
    const ctx = setupTest();

    const text = ctx.formatRefusal(
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
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    {
      exitCode: 3,
      lines: ['www: x'],
      runs: [{ shell: ['less', ['/srv/gh', 'p_demo/session'].join('')] }],
    },
    { sessionFlag: null },
  );

  expect(text).toBe('www: x\nRun: less "<where the secret lives>"\n');
});

test.each([
  ['a tab', '\t'],
  ['a line feed', '\n'],
  ['a carriage return and a line feed', '\r\n'],
  ['a vertical tab', '\v'],
  ['a form feed', '\f'],
  ['a next-line character', String.fromCodePoint(0x85)],
  ['a Unicode line separator', String.fromCodePoint(0x20_28)],
  ['a Unicode paragraph separator', String.fromCodePoint(0x20_29)],
])(
  'it prints the placeholder for each credential that %s splits at any offset in a Run word or a shell word',
  (_title, lineBreak) => {
    const ctx = setupTest();

    const cases = buildCredentialSamples().flatMap((credential) =>
      Array.from({ length: credential.sample.length - 1 }, (_unused, index) => ({
        name: `${credential.name} at ${String(index + 1)}`,
        split: `${credential.sample.slice(0, index + 1)}${lineBreak}${credential.sample.slice(index + 1)}`,
      })),
    );

    const printed = cases.filter(
      (entry) =>
        ctx.formatRefusal(
          {
            exitCode: 3,
            lines: ['www: x'],
            runs: [{ www: ['task', 't-a', entry.split] }, { shell: ['less', entry.split] }],
          },
          { sessionFlag: null },
        ) !==
        'www: x\nRun: www task t-a "<where the secret lives>"\nRun: less "<where the secret lives>"\n',
    );

    expect(printed.map((entry) => entry.name)).toStrictEqual([]);
  },
);
