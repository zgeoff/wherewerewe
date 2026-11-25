import { expect, test } from 'bun:test';
import { hasSecondArgument } from './has-second-argument.ts';

function setupTest() {
  return { hasSecondArgument };
}

test.each([
  { title: 'a call with one argument', text: 'a = render(input);', expected: false },
  { title: 'a call with two arguments', text: 'a = render(input, 5);', expected: true },
  { title: 'a trailing comma', text: 'a = render(\n  input,\n);', expected: false },
  { title: 'a comma inside a nested call', text: 'a = render(pick(x, y));', expected: false },
  { title: 'the declaration', text: 'function render(input, limit) {}', expected: false },
])('it answers $expected for $title', (row) => {
  const ctx = setupTest();

  expect(ctx.hasSecondArgument(row.text, 'render')).toBe(row.expected);
});
