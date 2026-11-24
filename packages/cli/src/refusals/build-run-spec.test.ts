import { expect, test } from 'bun:test';
import { buildRunSpec } from './build-run-spec.ts';
import { toPlaceholder } from './to-placeholder.ts';

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

test('it keeps only the check and note flags, only the first check, or drops a flag', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['t-a', 'Write it'],
    values: {},
    sessionFlag: null,
    flags: [
      { name: 'blocked-by', value: 'w-a' },
      { name: 'pr', value: 'acme/tool#7' },
      { name: 'pid', value: '5' },
      { name: 'note', value: 'Stop the simulator first' },
      { name: 'owed', value: null },
    ],
  });

  expect([
    spec.keepCheckAndNoteFlags().toArgv(),
    spec.keepFirstCheck().toArgv(),
    spec.dropFlag('blocked-by').toArgv(),
    spec.keepFlags(['pid']).renameCommand('set').toArgv(),
  ]).toStrictEqual([
    [
      'task',
      't-a',
      'Write it',
      '--pr',
      'acme/tool#7',
      '--pid',
      '5',
      '--note',
      'Stop the simulator first',
      '--owed',
    ],
    [
      'task',
      't-a',
      'Write it',
      '--blocked-by',
      'w-a',
      '--pr',
      'acme/tool#7',
      '--note',
      'Stop the simulator first',
      '--owed',
    ],
    [
      'task',
      't-a',
      'Write it',
      '--pr',
      'acme/tool#7',
      '--pid',
      '5',
      '--note',
      'Stop the simulator first',
      '--owed',
    ],
    ['set', 't-a', 'Write it', '--pid', '5'],
  ]);
});

test('it replaces the last copy of a flag typed twice, and drops the first', () => {
  const spec = buildRunSpec({
    command: 'wait',
    positionals: ['w-a', 'Answer'],
    values: {},
    sessionFlag: null,
    flags: [
      { name: 'who', value: 'old' },
      { name: 'pr', value: 'acme/tool#1' },
      { name: 'who', value: 'new=team' },
    ],
  });

  expect(spec.replaceFlag('who', 'new,team').toArgv()).toStrictEqual([
    'wait',
    'w-a',
    'Answer',
    '--pr',
    'acme/tool#1',
    '--who',
    'new,team',
  ]);
});

test('it keeps no flag when asked to keep none', () => {
  const spec = buildRunSpec({
    command: 'task',
    positionals: ['r-a', 'new note'],
    values: {},
    sessionFlag: null,
    flags: [{ name: 'pid', value: '5' }],
  });

  expect(spec.renameCommand('set').keepFlags([]).toArgv()).toStrictEqual([
    'set',
    'r-a',
    'new note',
  ]);
});

test('it joins a flag value that starts with a dash to its flag', () => {
  const spec = buildRunSpec({
    command: 'ok',
    positionals: ['ok-a'],
    values: {},
    sessionFlag: null,
    flags: [{ name: 'quote', value: '--preview' }],
  });

  expect(spec.toArgv()).toStrictEqual(['ok', 'ok-a', '--quote=--preview']);
});

test('it puts a placeholder where a typed value looks like a credential', () => {
  const spec = buildRunSpec({
    command: 'ok',
    positionals: ['ok-a'],
    values: {},
    sessionFlag: null,
    flags: [{ name: 'quote', value: `AKIA${'Q'.repeat(16)}` }],
  });

  expect(spec.toArgv()).toStrictEqual([
    'ok',
    'ok-a',
    '--quote',
    toPlaceholder('<where the secret lives>'),
  ]);
});
