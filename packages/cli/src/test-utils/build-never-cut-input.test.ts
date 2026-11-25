import { expect, test } from 'bun:test';
import { buildNeverCutInput } from './build-never-cut-input.ts';

function setupTest() {
  return { build: buildNeverCutInput };
}

test('it puts a wait in focus, shows its step, and types a 24-character session name', () => {
  const ctx = setupTest();
  const input = ctx.build(null);

  expect({
    focus: input.session.now,
    nowHidden: input.nowHidden,
    sessionFlag: input.sessionFlag,
  }).toStrictEqual({ focus: 'wait01xxxxxxxxxx', nowHidden: null, sessionFlag: 'n'.repeat(24) });
});
