import { expect, test } from 'bun:test';
import { parseCLIArgs } from './parse-cli-args.ts';

test.each([
  [[], 'brief', []],
  [['--session', 'tide'], 'brief', []],
  [['sessions'], 'sessions', []],
  [['detach'], 'detach', []],
  [['init', 'tide', '--goal', 'Ship it'], 'init', ['tide']],
  [['import', 'old-notes'], 'import', ['old-notes']],
  [['--session', 'old-notes', 'import', 'old-notes'], 'import', ['old-notes']],
  [['attach', 'tide'], 'attach', ['tide']],
  [['goal', 'Ship it'], 'goal', ['Ship it']],
  [['grant', '--may', 'Go.', '--where', 'chat', '--reading', 'covers it'], 'grant', []],
  [
    [
      'grant',
      '--may',
      'water the beds',
      '--may',
      'mow the lawn',
      '--not',
      'prune the roses',
      '--never',
      'dig up the roses',
      '--scope',
      'in the east garden',
      '--where',
      'chat',
      '--reading',
      'covers it',
    ],
    'grant',
    [],
  ],
  [['grant', '--reading', 'covers it'], 'grant', []],
  [
    [
      'import',
      'old-notes',
      '--may',
      'Go.',
      '--not',
      'prune the roses',
      '--never',
      'dig up the roses',
      '--scope',
      'in the east garden',
      '--where',
      'chat',
      '--reading',
      'covers it',
      '--drop',
      'ok-a',
      '--drop',
      'ok-b',
    ],
    'import',
    ['old-notes'],
  ],
  [['now', 't-a', 'go'], 'now', ['t-a', 'go']],
  [
    ['task', 't-a', 'Write it', '--pr', 'acme/tool#7', '--blocked-by', 'w-a'],
    'task',
    ['t-a', 'Write it'],
  ],
  [['wait', 'w-a', 'Answer', '--who', 'owner', '--pid', '5'], 'wait', ['w-a', 'Answer']],
  [['rule', 'r-a', 'Run from api/', '--path', '/srv'], 'rule', ['r-a', 'Run from api/']],
  [['where', 'wt-a', 'A worktree', '--branch', '/srv@fix'], 'where', ['wt-a', 'A worktree']],
  [['set', 't-a', 'Done', '--pr', 'acme/tool#7'], 'set', ['t-a', 'Done']],
  [['set', 't-a', '--note', 'x'], 'set', ['t-a']],
  [['set', 't-a', 'c', '--note', 'x', '--owed'], 'set', ['t-a', 'c']],
  [['set', 't-a', '--no-note'], 'set', ['t-a']],
  [['now', 't-a', 'go', '--note', 'x'], 'now', ['t-a', 'go']],
  [['say', 'x', '--on', 't-a'], 'say', ['x']],
  [['ack', 'o-1'], 'ack', ['o-1']],
  [['done', 't-a', '--evidence', 'commit 4c1d2e0'], 'done', ['t-a']],
  [['drop', 't-a', '--why', 'stopped'], 'drop', ['t-a']],
  [
    [
      'ok',
      'ok-a',
      '--quote',
      'go',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'the repo',
      '--once',
    ],
    'ok',
    ['ok-a'],
  ],
  [['use', 'ok-a', '--for', 'merged it'], 'use', ['ok-a']],
  [
    ['decide', 'Retry 3 times', '--why', 'It flaps', '--on', 't-a', '--ruled-out'],
    'decide',
    ['Retry 3 times'],
  ],
  [['show', 't-a'], 'show', ['t-a']],
  [['log', '--since', '24h', '--op', 'done,decide', '--id', 't-a'], 'log', []],
  [['--help'], 'help', []],
  [['-h'], 'help', []],
  [['help'], 'help', []],
])('it reads %p as the command %s with its positionals', (argv, command, positionals) => {
  const parsed = parseCLIArgs(argv);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({ command, positionals }),
  });
});

test('it keeps the --session value apart from the typed flags and lists the flags in the order typed', () => {
  const parsed = parseCLIArgs([
    'task',
    't-a',
    'Write it',
    '--pr',
    'acme/tool#7',
    '--session',
    'tide',
    '--blocked-by',
    'w-a',
  ]);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({
      sessionFlag: 'tide',
      flags: [
        { name: 'pr', value: 'acme/tool#7' },
        { name: 'blocked-by', value: 'w-a' },
      ],
    }),
  });
});

test('it sees a repeated check flag, so the write can refuse more than one check', () => {
  const parsed = parseCLIArgs([
    'task',
    't-a',
    'Write it',
    '--pr',
    'acme/tool#7',
    '--pr',
    'acme/tool#8',
  ]);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({
      flags: [
        { name: 'pr', value: 'acme/tool#7' },
        { name: 'pr', value: 'acme/tool#8' },
      ],
    }),
  });
});

test('it lets a claim that starts with a dash pass after a dash dash', () => {
  const parsed = parseCLIArgs(['task', 't-a', '--pid', '5', '--', '-flag first']);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({ command: 'task', positionals: ['t-a', '-flag first'] }),
  });
});

test.each([
  [['taks'], { kind: 'unknown-command', command: 'taks' }],
  [['brief'], { kind: 'unknown-command', command: 'brief' }],
  [['install'], { kind: 'later-command', command: 'install' }],
  [['doctor'], { kind: 'later-command', command: 'doctor' }],
  [['doctor', 'x'], { kind: 'later-command', command: 'doctor' }],
  [['hook', 'claude'], { kind: 'later-command', command: 'hook' }],
  [['task', 't-a', 'x', '--colour', 'red'], { kind: 'unknown-flag', flag: '--colour' }],
  [['task', 't-a', 'x', '-z'], { kind: 'unknown-flag', flag: '-z' }],
  [['goal', 'x', '--session'], { kind: 'flag-needs-value', flag: 'session' }],
  [['init', 'tide', '--goal'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['init', 'new-session', '--goal', '--session'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['init', 'new-session', '--goal', '-x'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['task', 't-a', 'x', '--help=yes'], { kind: 'flag-takes-no-value', flag: 'help' }],
  [['toString'], { kind: 'unknown-command', command: 'toString' }],
  [['constructor', 'x'], { kind: 'unknown-command', command: 'constructor' }],
  [['__proto__'], { kind: 'unknown-command', command: '__proto__' }],
  [['done', 't-a', '--why', 'x'], { kind: 'flag-not-taken', command: 'done', flag: 'why' }],
  [
    ['grant', '--quote', 'Go.', '--where', 'chat', '--reading', 'r'],
    { kind: 'flag-not-taken', command: 'grant', flag: 'quote' },
  ],
  [
    ['import', 'old-notes', '--quote', 'Go.', '--where', 'chat', '--reading', 'r'],
    { kind: 'flag-not-taken', command: 'import', flag: 'quote' },
  ],
  [['ok', 'ok-a', '--may', 'go'], { kind: 'flag-not-taken', command: 'ok', flag: 'may' }],
  [['task', 't-a', 'x', '--who', 'me'], { kind: 'flag-not-taken', command: 'task', flag: 'who' }],
  [
    ['wait', 'w-a', 'x', '--blocked-by', 't-a'],
    { kind: 'flag-not-taken', command: 'wait', flag: 'blocked-by' },
  ],
  [['sessions', '--goal', 'x'], { kind: 'flag-not-taken', command: 'sessions', flag: 'goal' }],
  [['task', 't-a', '--help'], { kind: 'flag-not-taken', command: 'task', flag: 'help' }],
  [['--pr', 'a/b#1'], { kind: 'flag-not-taken', command: 'brief', flag: 'pr' }],
  [['task', 't-a', 'c', '--no-note'], { kind: 'flag-not-taken', command: 'task', flag: 'no-note' }],
  [['set'], { kind: 'wrong-positionals', command: 'set', usage: '<id> ["<claim>"]' }],
  [['task', 't-a'], { kind: 'wrong-positionals', command: 'task', usage: '<id> "<claim>"' }],
  [
    ['task', 't-a', 'x', 'y'],
    { kind: 'wrong-positionals', command: 'task', usage: '<id> "<claim>"' },
  ],
  [['goal'], { kind: 'wrong-positionals', command: 'goal', usage: '"<what done means>"' }],
  [['now', 't-a'], { kind: 'wrong-positionals', command: 'now', usage: '<id> "<next step>"' }],
  [['done'], { kind: 'wrong-positionals', command: 'done', usage: '<id>' }],
  [['sessions', 'x'], { kind: 'wrong-positionals', command: 'sessions', usage: 'no arguments' }],
  [['help', 'x'], { kind: 'wrong-positionals', command: 'help', usage: 'no arguments' }],
  [['attach'], { kind: 'wrong-positionals', command: 'attach', usage: '<name>' }],
])('it refuses %p with %p', (argv, reason) => {
  const actual: unknown = parseCLIArgs(argv);

  expect(actual).toStrictEqual({ kind: 'refused', reason, sessionFlag: null });
});

test('it hands back the --session value typed with a command it refuses', () => {
  const actual: unknown = parseCLIArgs(['--session', 'tide', 'taks']);

  expect(actual).toStrictEqual({
    kind: 'refused',
    reason: { kind: 'unknown-command', command: 'taks' },
    sessionFlag: 'tide',
  });
});
