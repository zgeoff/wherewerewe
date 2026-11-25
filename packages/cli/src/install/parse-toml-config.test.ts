import { expect, test } from 'bun:test';
import { parseTOMLConfig } from './parse-toml-config.ts';

function setupTest() {
  return { parse: parseTOMLConfig };
}

test('it reads a comment after a table header and a path that only a comment holds', () => {
  const ctx = setupTest();

  expect(
    ctx.parse(
      "[features] # toggles\nhooks = false\n[sandbox_workspace_write]\nwritable_roots = [] # '/a/b'\n",
    ),
  ).toStrictEqual({ features: { hooks: false }, sandbox_workspace_write: { writable_roots: [] } });
});

test('it reads a single-quoted string', () => {
  const ctx = setupTest();

  expect(ctx.parse("command = '/a/wherewerewe hook codex'\n")).toStrictEqual({
    command: '/a/wherewerewe hook codex',
  });
});

test('it reads an empty text as an empty table', () => {
  const ctx = setupTest();

  expect(ctx.parse('')).toStrictEqual({});
});

test('it reads text that is not TOML as null', () => {
  const ctx = setupTest();

  expect(ctx.parse('hooks = [')).toBeNull();
});
