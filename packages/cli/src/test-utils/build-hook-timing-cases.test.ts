import { expect, test } from 'bun:test';
import { buildHookTimingCases } from './build-hook-timing-cases.ts';

function setupTest() {
  return { build: buildHookTimingCases };
}

test('it holds six cases for each harness with the design limits', () => {
  const ctx = setupTest();

  expect(
    ctx.build().map((row) => `${row.harness} ${row.title} ${String(row.limitMs)}`),
  ).toStrictEqual([
    'claude an unbound PreToolUse 150',
    'claude a bound PreToolUse 150',
    'claude an unbound Stop 150',
    'claude a bound Stop 150',
    'claude a bound PostToolUse 300',
    'claude a bound SessionStart 300',
    'codex an unbound PreToolUse 150',
    'codex a bound PreToolUse 150',
    'codex an unbound Stop 150',
    'codex a bound Stop 150',
    'codex a bound PostToolUse 300',
    'codex a bound SessionStart 300',
  ]);
});
