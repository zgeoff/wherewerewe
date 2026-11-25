import { expect, test } from 'bun:test';
import { buildTextPlan } from './build-text-plan.ts';

function setupTest() {
  return { build: buildTextPlan };
}

test('it builds a text plan with no notices and no lines', () => {
  const ctx = setupTest();

  expect(ctx.build('one\n')).toStrictEqual({
    kind: 'text',
    text: 'one\n',
    notices: [],
    changedLine: '',
    sameLine: '',
  });
});
