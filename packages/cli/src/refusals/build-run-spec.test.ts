import { expect, test } from 'bun:test';
import { buildRunSpec } from './build-run-spec.ts';

test('it rebuilds the command as typed, positionals first and flags after', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['t-a', 'Write it'],
    values: {},
    sessionFlag: null,
    flags: [
      { name: 'pr', value: 'acme/tool#7' },
      { name: 'blocked-by', value: 'w-a' },
    ],
  });

  expect(spec.toArgv()).toStrictEqual([
    'task',
    't-a',
    'Write it',
    '--pr',
    'acme/tool#7',
    '--blocked-by',
    'w-a',
  ]);
});

test('it leaves the command word out for the brief', () => {
  const spec = buildRunSpec({
    command: 'brief',
    positionals: [],
    values: {},
    sessionFlag: null,
    flags: [],
  });

  expect(spec.toArgv()).toStrictEqual([]);
});

test('it puts the flags before a dash dash when a positional starts with a dash', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['t-a', '-dash first'],
    values: {},
    sessionFlag: null,
    flags: [{ name: 'pid', value: '5' }],
  });

  expect(spec.toArgv()).toStrictEqual(['--pid', '5', '--', 'task', 't-a', '-dash first']);
});

test('it edits positionals and flags without changing the spec it came from', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['t-a', 'Write it'],
    values: {},
    sessionFlag: null,
    flags: [
      { name: 'pr', value: 'acme/tool#7' },
      { name: 'pid', value: '5' },
      { name: 'blocked-by', value: 'w-a' },
    ],
  });

  const edited = spec
    .replacePositional(0, 't-b')
    .replaceFlag('blocked-by', 'w-b')
    .addFlag('who', 'me');

  expect([spec.toArgv(), edited.toArgv()]).toStrictEqual([
    ['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--pid', '5', '--blocked-by', 'w-a'],
    [
      'task',
      't-b',
      'Write it',
      '--pr',
      'acme/tool#7',
      '--pid',
      '5',
      '--blocked-by',
      'w-b',
      '--who',
      'me',
    ],
  ]);
});

test('it keeps only the check flags, only the first check, or drops a flag', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['t-a', 'Write it'],
    values: {},
    sessionFlag: null,
    flags: [
      { name: 'blocked-by', value: 'w-a' },
      { name: 'pr', value: 'acme/tool#7' },
      { name: 'pid', value: '5' },
    ],
  });

  expect([
    spec.keepCheckFlags().toArgv(),
    spec.keepFirstCheck().toArgv(),
    spec.dropFlag('blocked-by').toArgv(),
    spec.keepFlags(['pid']).renameCommand('set').toArgv(),
  ]).toStrictEqual([
    ['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--pid', '5'],
    ['task', 't-a', 'Write it', '--blocked-by', 'w-a', '--pr', 'acme/tool#7'],
    ['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--pid', '5'],
    ['set', 't-a', 'Write it', '--pid', '5'],
  ]);
});
