import { expect, test } from 'bun:test';
import { isReadCommand } from './is-read-command.ts';

function setupTest() {
  return { isReadCommand };
}

test.each([['brief'], ['show'], ['log'], ['list'], ['recap'], ['sessions'], ['help']])(
  'it takes %s as a command that only reads',
  (command) => {
    const ctx = setupTest();

    expect(ctx.isReadCommand(command)).toBe(true);
  },
);

test.each([['task'], ['init'], ['goal'], ['say']])(
  'it takes %s as a command that writes',
  (command) => {
    const ctx = setupTest();

    expect(ctx.isReadCommand(command)).toBe(false);
  },
);
