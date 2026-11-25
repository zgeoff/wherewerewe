import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildRefusalReplay } from '../test-utils/build-refusal-replay.ts';
import { buildRefusalSamples } from '../test-utils/build-refusal-samples.ts';
import { getSteeringWords } from '../test-utils/get-steering-words.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import type { RunWord } from '../types.ts';
import { buildRefusal } from './build-refusal.ts';
import { formatRefusal, nothingWrittenComment } from './format-refusal.ts';
import { toPlaceholder } from './to-placeholder.ts';

function setupTest() {
  const root = createTempDir('format-refusal').path;
  const bin = join(root, 'bin');
  const replayBin = join(root, 'replay-bin');
  const cwd = join(root, 'cwd');

  seedStubCommand(bin, 'www', `printf 'www\\n'; printf '%s\\n' "$@"`);
  seedStubCommand(bin, 'less', `printf 'less\\n'; printf '%s\\n' "$@"`);

  // each argument ends in a unit separator and each call in a record separator, so an argument can
  // hold any character but those two
  seedStubCommand(replayBin, 'www', String.raw`printf '%s\037' www "$@"; printf '\036'`);
  seedStubCommand(replayBin, 'less', String.raw`printf '%s\037' less "$@"; printf '\036'`);
  seedStubCommand(replayBin, 'bun', String.raw`printf '%s\037' bun "$@"; printf '\036'`);
  mkdirSync(cwd);

  // the flags a refusal's Run line may leave out: one whose own presence is what it refuses, or
  // every flag when the line runs another command
  const droppedFlags: Readonly<Record<string, readonly string[]>> = {
    // --no-note and the --note the fix gives cannot both stand
    'owed-needs-note': ['no-note'],
    'note-and-no-note': ['no-note'],

    // an item holds one check, so the second check flag goes
    'too-many-checks': ['pr', 'branch', 'path', 'pid'],

    // the line writes the owed note first, with set
    'owed-note': ['evidence'],

    // the line is www grant, where lasting permission lives
    'ok-standing': ['quote', 'who', 'where', 'scope', 'standing'],

    // a --drop that names no item: a placeholder would drop an item the upgrade keeps
    'upgrade-refused': ['drop'],
  };

  return {
    droppedFlags,

    // the flag names a Run line holds, from its words
    readRunFlags: (argv: readonly RunWord[]) =>
      argv.flatMap((word) =>
        typeof word === 'string' && word.startsWith('--') && word !== '--'
          ? [word.slice(2).split('=')[0] ?? '']
          : [],
      ),
    formatRefusal,
    buildRefusalReplay,
    runInShell: (command: string) =>
      run(['bash', '--posix', '-c', command], {
        env: { PATH: `${bin}:/usr/bin:/bin` },
        cwd,
      }),
    replayInShell: (script: string) =>
      run(['bash', '--posix', '-c', script], {
        env: { PATH: `${replayBin}:/usr/bin:/bin` },
        cwd,
        input: '',
        timeoutMs: 4000,
      }),
  };
}

test('it prints the lines, then each run as a Run line', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    {
      exitCode: 3,
      lines: ['www: refused: drop needs a reason.'],
      runs: [{ www: ['drop', 'p-sim', '--why', toPlaceholder('<reason>')] }],
    },
    { sessionFlag: null, writes: false },
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
    { sessionFlag: 'tide-alerts', writes: false },
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
    { sessionFlag: 'tide-alerts', writes: false },
  );

  expect(text).toBe(`www: x\n${expected}\n`);
});

test('it adds no --session to a run that already names one', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 3, lines: ['www: x'], runs: [{ www: ['--session', 'other', 'task', 't-a'] }] },
    { sessionFlag: 'tide-alerts', writes: false },
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
    { sessionFlag: 'tide-alerts', writes: false },
  );

  expect(text).toBe('www: x\nRun: bun add -g @wherewerewe/cli@latest\n');
});

test('it redacts a --session value that looks like a credential', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 2, lines: ['www: --goal needs a value.'], runs: [{ www: ['help'] }] },
    { sessionFlag: ['xoxb', '-', '12'].join(''), writes: false },
  );

  expect(text).toBe(
    'www: --goal needs a value.\nRun: www --session "<where the secret lives>" help\n',
  );
});

test('it adds no second --session to a Run line that holds --session=<name>', () => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 2, lines: ['www: x'], runs: [{ www: ['--session=tide-alerts', 'goal', 'x'] }] },
    { sessionFlag: 'tide-alerts', writes: false },
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
      { sessionFlag: `tide${lineBreak}alerts`, writes: false },
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
    { sessionFlag: null, writes: false },
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
          { sessionFlag: null, writes: false },
        ) !==
        'www: x\nRun: www task t-a "<where the secret lives>"\nRun: less "<where the secret lives>"\n',
    );

    expect(printed.map((entry) => entry.name)).toStrictEqual([]);
  },
);

test.each([
  {
    title: 'a fixed call',
    runs: [{ www: ['task', 't-a', 'Write it'] }],
    last: 'Run: www task t-a "Write it"',
  },
  {
    title: 'a usage line',
    runs: [{ usage: 'now <id> "<next step>"' }],
    last: 'Run: www now <id> "<next step>"',
  },
  { title: 'the help', runs: [{ www: ['help'] }], last: 'Run: www help' },
  {
    title: 'a shell command',
    runs: [{ shell: ['less', '/srv/tide-alerts/items.tsv'] }],
    last: 'Run: less /srv/tide-alerts/items.tsv',
  },
  {
    title: 'two Run lines, of which only the last ends with the comment',
    runs: [{ www: ['help'] }, { www: ['now', 't-a', 'go on'] }],
    last: 'Run: www now t-a "go on"',
  },
])('it ends the last Run line of a refused write with the comment: $title', (row) => {
  const ctx = setupTest();

  const lines = ctx
    .formatRefusal(
      { exitCode: 3, lines: ['www: refused: x.'], runs: row.runs },
      { sessionFlag: null, writes: true },
    )
    .trimEnd()
    .split('\n');

  const expected =
    row.runs.length === 1
      ? [`${row.last}${nothingWrittenComment}`]
      : ['Run: www help', `${row.last}${nothingWrittenComment}`];

  expect(lines.slice(1)).toStrictEqual(expected);
});

test.each([
  { title: 'a fixed call', runs: [{ www: ['show', 'zz'] }] },
  { title: 'a kind to list', runs: [{ www: ['list', 'tasks'] }] },
])('it ends the last Run line of a refused read with no comment: $title', (row) => {
  const ctx = setupTest();

  const text = ctx.formatRefusal(
    { exitCode: 2, lines: ['www: x.'], runs: row.runs },
    { sessionFlag: null, writes: false },
  );

  expect(text).not.toInclude(nothingWrittenComment);
});

test.each([
  {
    title: 'a fixed call',
    runs: [{ www: ['task', 't-a', 'Write it'] }],
    echoed: ['www', 'task', 't-a', 'Write it'],
  },
  {
    title: 'a quoted placeholder',
    runs: [{ www: ['task', 't-a', toPlaceholder('<claim>')] }],
    echoed: ['www', 'task', 't-a', '<claim>'],
  },
  {
    title: 'a value with shell characters and a hash',
    runs: [{ www: ['task', 't-a', 'costs $5 # not a comment `x` "y"'] }],
    echoed: ['www', 'task', 't-a', 'costs $5 # not a comment `x` "y"'],
  },
  {
    title: 'a shell command with a path that holds a space',
    runs: [{ shell: ['less', '/srv/tide alerts/items.tsv'] }],
    echoed: ['less', '/srv/tide alerts/items.tsv'],
  },
  {
    title: 'the last of two Run lines',
    runs: [{ www: ['help'] }, { www: ['now', 't-a', 'go on'] }],
    echoed: ['www', 'now', 't-a', 'go on'],
  },
])(
  'it ends the Run line of a refused write with a comment that a POSIX shell reads as none: $title',
  async (row) => {
    const ctx = setupTest();

    const text = ctx.formatRefusal(
      { exitCode: 3, lines: ['www: x.'], runs: row.runs },
      { sessionFlag: null, writes: true },
    );

    const last = text.trimEnd().split('\n').at(-1) ?? '';

    const replayed = await ctx.runInShell(last.slice('Run: '.length));

    expect({
      exitCode: replayed.exitCode,
      stdout: replayed.stdout,
      stderr: replayed.stderr,
    }).toStrictEqual({
      exitCode: 0,
      stdout: `${row.echoed.join('\n')}\n`,
      stderr: '',
    });
  },
);

test.each(buildRefusalSamples())(
  'it prints each Run line of $title so a POSIX shell hands its program the words, with --session as typed',
  async (row) => {
    const ctx = setupTest();

    const replay = ctx.buildRefusalReplay(buildRefusal(row.reason), [
      { sessionFlag: null, writes: false },
      { sessionFlag: null, writes: true },
      { sessionFlag: 'tide$TAG;x`id`"q"\\ |&*#', writes: false },
      { sessionFlag: 'tide$TAG;x`id`"q"\\ |&*#', writes: true },
      { sessionFlag: "it's!(x)<y>[z]", writes: true },
    ]);

    const replayed = await ctx.replayInShell(replay.script);

    expect({
      exitCode: replayed.exitCode,
      stderr: replayed.stderr,
      received: replayed.stdout
        .split('\u001E')
        .slice(0, -1)
        .map((record) => record.split('\u001F').slice(0, -1)),
      comments: replay.comments,
    }).toStrictEqual({
      exitCode: 0,
      stderr: '',
      received: replay.expected,
      comments: replay.expectedComments,
    });
  },
);

test.each(buildRefusalSamples().filter((row) => row.reason.kind === 'text-too-long'))(
  'it follows the reason of $title with what to do with the rest when the text states a fact',
  (row) => {
    // the texts an agent writes as a fact in a row; a name, a place, a date, the owner's own words
    // and the grant's parts stay one line
    const factLabels = [
      'claim',
      'next step',
      'note',
      'decision',
      'reason',
      'evidence',
      'why',
      'lesson',
      'promise',
      '--for text',
    ];

    const label = row.reason.kind === 'text-too-long' ? row.reason.target.label : '';
    const lines = buildRefusal(row.reason).lines;
    const rest = lines.slice(1);

    expect({
      first: lines[0]?.includes(' and the limit is '),
      rest,
      steering: getSteeringWords(lines.join('\n')),
    }).toStrictEqual({
      first: true,
      rest: factLabels.includes(label)
        ? [
            'One row holds one fact: split the rest into rows, or put the detail in a file as a list or a table and record the file with www where.',
          ]
        : [],
      steering: [],
    });
  },
);

test.each(
  buildRefusalSamples().flatMap((row) =>
    'args' in row.reason && row.reason.args.flags.length > 0 ? [row] : [],
  ),
)('it keeps each flag typed in $title on its Run line', (row) => {
  const ctx = setupTest();
  const typed = 'args' in row.reason ? row.reason.args.flags.map((flag) => flag.name) : [];
  const refusal = buildRefusal(row.reason);
  const found = refusal.runs.find((candidate) => 'www' in candidate);
  const kept = found !== undefined && 'www' in found ? ctx.readRunFlags(found.www) : [];
  const mayDrop = ctx.droppedFlags[row.reason.kind] ?? [];

  expect({
    kind: row.reason.kind,
    lost: typed.filter((flag) => !kept.includes(flag) && !mayDrop.includes(flag)),
  }).toStrictEqual({ kind: row.reason.kind, lost: [] });
});
