import { expect, test } from 'bun:test';
import { agentVariables, isOwnerTerminal } from './is-owner-terminal.ts';

test.each([
  {
    title: 'both terminals and no variable',
    terminal: { stdin: true, stdout: true },
    env: {},
    expected: true,
  },
  {
    title: 'stdin not a terminal',
    terminal: { stdin: false, stdout: true },
    env: {},
    expected: false,
  },
  {
    title: 'stdout not a terminal',
    terminal: { stdin: true, stdout: false },
    env: {},
    expected: false,
  },
  ...agentVariables.map((name) => ({
    title: `${name} set to 1`,
    terminal: { stdin: true, stdout: true },
    env: { [name]: '1' },
    expected: false,
  })),
  ...agentVariables.map((name) => ({
    title: `${name} set to an empty value`,
    terminal: { stdin: true, stdout: true },
    env: { [name]: '' },
    expected: true,
  })),
])('it answers $expected for $title', (row) => {
  expect(isOwnerTerminal({ env: row.env, terminal: row.terminal })).toBe(row.expected);
});
