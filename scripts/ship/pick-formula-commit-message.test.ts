import { expect, test } from 'bun:test';
import { pickFormulaCommitMessage } from './pick-formula-commit-message.ts';

function setupTest() {
  return { pickFormulaCommitMessage };
}

test('it commits the formula under the version when git staged a change', () => {
  const ctx = setupTest();

  expect(ctx.pickFormulaCommitMessage(1, '4.2.0')).toBe('wherewerewe 4.2.0');
});

test('it commits nothing when git staged no change', () => {
  const ctx = setupTest();

  expect(ctx.pickFormulaCommitMessage(0, '4.2.0')).toBeNull();
});

test('it refuses a git diff that failed, never reading it as a formula already in place', () => {
  const ctx = setupTest();

  expect(() => ctx.pickFormulaCommitMessage(128, '4.2.0')).toThrowWithMessage(
    Error,
    'git diff --cached exited 128',
  );
});
