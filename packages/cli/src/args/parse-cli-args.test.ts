import { expect, test } from 'bun:test';
import { parseCLIArgs } from './parse-cli-args.ts';

function setupTest() {
  return { parseCLIArgs };
}

test.each([
  [[], 'brief', []],
  [['--session', 'tide'], 'brief', []],
  [['sessions'], 'sessions', []],
  [['detach'], 'detach', []],
  [['show'], 'show', []],
  [['show', 't-a'], 'show', ['t-a']],
  [['init', 'tide', '--goal', 'Ship it'], 'init', ['tide']],
  [['import', 'old-notes'], 'import', ['old-notes']],
  [['--session', 'old-notes', 'import', 'old-notes'], 'import', ['old-notes']],
  [['attach', 'tide'], 'attach', ['tide']],
  [['goal', 'Ship it'], 'goal', ['Ship it']],
  [['goal', '--paste'], 'goal', []],
  [['--session', 'tide', 'goal', '--paste'], 'goal', []],
  [['--json'], 'brief', []],
  [['--session', 'tide', '--json'], 'brief', []],
  [['show', '--json'], 'show', []],
  [['show', 't-a', '--json'], 'show', ['t-a']],
  [['--session', 'tide', 'show', '--json'], 'show', []],
  [['log', '--json'], 'log', []],
  [['--session', 'tide', 'log', '--since', '2h', '--json'], 'log', []],
  [['list', 'rules', '--json'], 'list', ['rules']],
  [['recap', '--json'], 'recap', []],
  [['--session', 'tide', 'recap', '--json'], 'recap', []],
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
  [['recap'], 'recap', []],
  [['recap', '--since', '3d'], 'recap', []],
  [['--help'], 'help', []],
  [['-h'], 'help', []],
  [['help'], 'help', []],
])('it reads %p as the command %s with its positionals', (argv, command, positionals) => {
  const ctx = setupTest();
  const parsed = ctx.parseCLIArgs(argv);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({ command, positionals }),
  });
});

test('it keeps the --session value apart from the typed flags and lists the flags in the order typed', () => {
  const ctx = setupTest();

  const parsed = ctx.parseCLIArgs([
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
  const ctx = setupTest();

  const parsed = ctx.parseCLIArgs([
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

test.each([
  { argv: ['install'], command: 'install' },
  { argv: ['install', '--print'], command: 'install' },
  { argv: ['install', '--replace-skill'], command: 'install' },
  { argv: ['doctor'], command: 'doctor' },
  { argv: ['hook', 'claude'], command: 'hook' },
  { argv: ['hook', 'codex'], command: 'hook' },
])('it takes $argv as the command $command', (row) => {
  const ctx = setupTest();

  expect(ctx.parseCLIArgs(row.argv)).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({ command: row.command }),
  });
});

test('it lets a claim that starts with a dash pass after a dash dash', () => {
  const ctx = setupTest();
  const parsed = ctx.parseCLIArgs(['task', 't-a', '--pid', '5', '--', '-flag first']);

  expect(parsed).toStrictEqual({
    kind: 'args',
    args: expect.objectContaining({ command: 'task', positionals: ['t-a', '-flag first'] }),
  });
});

test.each([
  [['taks'], { kind: 'unknown-command', command: 'taks' }],
  [['brief'], { kind: 'unknown-command', command: 'brief' }],
  [
    ['doctor', 'x'],
    { kind: 'wrong-positionals', command: 'doctor', usage: 'no arguments', line: 'doctor' },
  ],
  [
    ['hook', 'gemini'],
    {
      kind: 'wrong-positionals',
      command: 'hook',
      usage: '<claude|codex>',
      line: 'hook <claude|codex>',
    },
  ],
  [
    ['task', 't-a', 'x', '--colour', 'red'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '--colour',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['task', 't-a', 'x', '-z'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '-z',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [['taks', '--colour'], { kind: 'unknown-command', command: 'taks' }],
  [
    ['goal', 'x', '--colour2=red'],
    {
      kind: 'flag-not-taken',
      command: 'goal',
      flag: '--colour2',
      taken: ['paste'],
      line: 'goal "<what done means>"',
    },
  ],
  [['brief', '--colour'], { kind: 'unknown-command', command: 'brief' }],
  [
    ['doctor', '--colour'],
    { kind: 'flag-not-taken', command: 'doctor', flag: '--colour', taken: [], line: 'doctor' },
  ],
  [['goal', 'x', '--session'], { kind: 'flag-needs-value', flag: 'session' }],
  [['init', 'tide', '--goal'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['init', 'new-session', '--goal', '--session'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['init', 'new-session', '--goal', '-h'], { kind: 'flag-needs-value', flag: 'goal' }],
  [['task', 't-a', 'x', '--note', '--', '--claim'], { kind: 'flag-needs-value', flag: 'note' }],
  [
    ['grant', '--may', 'a', '--never', '--deny', '--where', '--reading', 'r'],
    { kind: 'flag-needs-value', flag: 'where' },
  ],
  [
    ['init', 'new-session', '--goal', '-x'],
    { kind: 'flag-value-has-dash', flag: 'goal', argv: ['init', 'new-session', '--goal=-x'] },
  ],
  [
    [
      'grant',
      '--may',
      'Go.',
      '--never',
      '--admin or a bypass',
      '--where',
      'chat',
      '--reading',
      'r',
    ],
    {
      kind: 'flag-value-has-dash',
      flag: 'never',
      argv: [
        'grant',
        '--may',
        'Go.',
        '--never=--admin or a bypass',
        '--where',
        'chat',
        '--reading',
        'r',
      ],
    },
  ],
  [
    ['import', 'old-notes', '--not', '-x', '--never', '--y', '--', 'z'],
    {
      kind: 'flag-value-has-dash',
      flag: 'not',
      argv: ['import', 'old-notes', '--not=-x', '--never=--y', '--', 'z'],
    },
  ],
  [['task', 't-a', 'x', '--help=yes'], { kind: 'flag-takes-no-value', flag: 'help' }],
  [['toString'], { kind: 'unknown-command', command: 'toString' }],
  [['constructor', 'x'], { kind: 'unknown-command', command: 'constructor' }],
  [['__proto__'], { kind: 'unknown-command', command: '__proto__' }],
  [
    ['done', 't-a', '--why', 'x'],
    {
      kind: 'flag-not-taken',
      command: 'done',
      flag: '--why',
      taken: ['evidence'],
      line: 'done <id> --evidence "<PR, commit or test run>"',
    },
  ],
  [
    ['grant', '--quote', 'Go.', '--where', 'chat', '--reading', 'r'],
    {
      kind: 'flag-not-taken',
      command: 'grant',
      flag: '--quote',
      taken: ['may', 'not', 'never', 'scope', 'where', 'reading'],
      line: 'grant [--may "<words>"] [--not "<words>"] [--never "<words>"] [--scope "<scope>"] --where <where> --reading "<what they cover; what the owner kept back>"',
    },
  ],
  [
    ['import', 'old-notes', '--quote', 'Go.', '--where', 'chat', '--reading', 'r'],
    {
      kind: 'flag-not-taken',
      command: 'import',
      flag: '--quote',
      taken: ['may', 'not', 'never', 'scope', 'where', 'reading', 'drop'],
      line: 'import <name>',
    },
  ],
  [
    ['ok', 'ok-a', '--may', 'go'],
    {
      kind: 'flag-not-taken',
      command: 'ok',
      flag: '--may',
      taken: ['quote', 'who', 'where', 'scope', 'once', 'note', 'owed'],
      line: 'ok <id> --quote "<their exact words>" --who <who> --where <where> --scope "<scope>"',
    },
  ],
  [
    ['task', 't-a', 'x', '--who', 'me'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '--who',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['wait', 'w-a', 'x', '--blocked-by', 't-a'],
    {
      kind: 'flag-not-taken',
      command: 'wait',
      flag: '--blocked-by',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'who'],
      line: 'wait <id> "<what>" --who <who> [<check>]',
    },
  ],
  [
    ['sessions', '--goal', 'x'],
    { kind: 'flag-not-taken', command: 'sessions', flag: '--goal', taken: [], line: 'sessions' },
  ],
  [
    ['task', 't-a', '--help'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '--help',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['--pr', 'a/b#1'],
    { kind: 'flag-not-taken', command: 'brief', flag: '--pr', taken: ['json'], line: '' },
  ],
  [
    ['task', 't-a', 'c', '--no-note'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '--no-note',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['rule', 'r-a', 'x', '--who', 'me'],
    {
      kind: 'flag-not-taken',
      command: 'rule',
      flag: '--who',
      taken: ['note', 'owed'],
      line: 'rule <id> "<do it this way, and why>"',
    },
  ],
  [
    ['set'],
    {
      kind: 'wrong-positionals',
      command: 'set',
      usage: '<id> ["<claim>"]',
      line: 'set <id> ["<claim>"] [<check>] [--note "<detail>" [--owed] | --no-note]',
    },
  ],
  [
    ['task', 't-a'],
    {
      kind: 'wrong-positionals',
      command: 'task',
      usage: '<id> "<claim>"',
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['recap', 'x'],
    {
      kind: 'wrong-positionals',
      command: 'recap',
      usage: 'no arguments',
      line: 'recap [--since <t>]',
    },
  ],
  [
    ['show', 'a', 'b'],
    { kind: 'wrong-positionals', command: 'show', usage: '[<id>]', line: 'show [<id>]' },
  ],
  [
    ['recap', '--op', 'decide'],
    {
      kind: 'flag-not-taken',
      command: 'recap',
      flag: '--op',
      taken: ['since', 'json'],
      line: 'recap [--since <t>]',
    },
  ],
  [
    ['task', 't-a', 'x', 'y'],
    {
      kind: 'wrong-positionals',
      command: 'task',
      usage: '<id> "<claim>"',
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['goal'],
    {
      kind: 'wrong-positionals',
      command: 'goal',
      usage: '"<what done means>"',
      line: 'goal "<what done means>"',
    },
  ],
  [
    ['now', 't-a'],
    {
      kind: 'wrong-positionals',
      command: 'now',
      usage: '<id> "<next step>"',
      line: 'now <id> "<next step>" [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['done'],
    {
      kind: 'wrong-positionals',
      command: 'done',
      usage: '<id>',
      line: 'done <id> --evidence "<PR, commit or test run>"',
    },
  ],
  [
    ['sessions', 'x'],
    { kind: 'wrong-positionals', command: 'sessions', usage: 'no arguments', line: 'sessions' },
  ],
  [
    ['help', 'x'],
    { kind: 'wrong-positionals', command: 'help', usage: 'no arguments', line: 'help' },
  ],
  [
    ['task', 't-a', 'x', '--json'],
    {
      kind: 'flag-not-taken',
      command: 'task',
      flag: '--json',
      taken: ['pr', 'branch', 'path', 'pid', 'note', 'owed', 'blocked-by'],
      line: 'task <id> "<claim>" [<check>] [--blocked-by <id>] [--note "<detail>" [--owed]]',
    },
  ],
  [
    ['sessions', '--json'],
    { kind: 'flag-not-taken', command: 'sessions', flag: '--json', taken: [], line: 'sessions' },
  ],
  [
    ['help', '--json'],
    { kind: 'flag-not-taken', command: 'help', flag: '--json', taken: [], line: 'help' },
  ],
  [['--json=1'], { kind: 'flag-takes-no-value', flag: 'json' }],
  [['goal', '--paste', 'Ship it'], { kind: 'goal-paste-with-text' }],
  [
    ['goal', '--paste', '--json'],
    {
      kind: 'flag-not-taken',
      command: 'goal',
      flag: '--json',
      taken: ['paste'],
      line: 'goal "<what done means>"',
    },
  ],
  [
    ['attach'],
    { kind: 'wrong-positionals', command: 'attach', usage: '<name>', line: 'attach <name>' },
  ],
])('it refuses %p with %p', (argv, reason) => {
  const ctx = setupTest();
  const actual: unknown = ctx.parseCLIArgs(argv);

  expect(actual).toStrictEqual({ kind: 'refused', reason, sessionFlag: null });
});

test('it hands back the --session value typed with a command it refuses', () => {
  const ctx = setupTest();
  const actual: unknown = ctx.parseCLIArgs(['--session', 'tide', 'taks']);

  expect(actual).toStrictEqual({
    kind: 'refused',
    reason: { kind: 'unknown-command', command: 'taks' },
    sessionFlag: 'tide',
  });
});

test('it hands back the --session value typed with a goal text beside --paste', () => {
  const ctx = setupTest();

  const actual: unknown = ctx.parseCLIArgs([
    '--session',
    'tide-alerts',
    'goal',
    'Ship it',
    '--paste',
  ]);

  expect(actual).toStrictEqual({
    kind: 'refused',
    reason: { kind: 'goal-paste-with-text' },
    sessionFlag: 'tide-alerts',
  });
});
