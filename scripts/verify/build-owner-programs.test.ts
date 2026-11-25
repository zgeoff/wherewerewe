import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildOwnerPrograms } from './build-owner-programs.ts';

test('it names the five programs of the owner-notes journey', () => {
  const programs = buildOwnerPrograms(createTempDir('owner-programs').path);

  expect(Object.keys(programs)).toStrictEqual([
    'say-as-agent',
    'say-first',
    'say-second',
    'say-third',
    'ack-first',
  ]);
});

test.each([
  {
    name: 'say-as-agent',
    tail: ['say', 'A note from an agent shell'],
    isAgent: true,
  },
  {
    name: 'say-first',
    tail: ['say', 'Ask me before you change the kiln simulator port.'],
    isAgent: false,
  },
  {
    name: 'say-second',
    tail: ['say', 'Use the recorded kiln readings in the timer tests', '--on', 't-timer'],
    isAgent: false,
  },
  {
    name: 'say-third',
    tail: ['say', 'Ship the timer before the Friday firing'],
    isAgent: false,
  },
  { name: 'ack-first', tail: ['ack', 'o-1'], isAgent: false },
])('it runs $name as www in trial-owner, with CODEX_CI set only for the agent', (row) => {
  const command = buildOwnerPrograms(createTempDir('owner-programs').path)[row.name]?.command ?? [];

  expect({
    tail: command.slice(-row.tail.length - 2),
    hasCodexCI: command.includes('CODEX_CI=1'),
    unsetsFirst: command.slice(4, 7),
  }).toStrictEqual({
    tail: ['--session', 'trial-owner', ...row.tail],
    hasCodexCI: row.isAgent,
    unsetsFirst: ['env', '-u', 'CLAUDECODE'],
  });
});
