import { expect, test } from 'bun:test';
import { readChangedPaths } from './read-changed-paths.ts';

test('it lists each changed, added and removed path, sorted, and not an unchanged one', () => {
  const changed = readChangedPaths(
    { 'a/session': 'h1', 'a/items.tsv': 'h2', '.bindings/claude-1': 'h3' },
    { 'a/session': 'h9', 'a/items.tsv': 'h2', 'a/journal.tsv': 'h4' },
  );

  expect(changed).toStrictEqual(['.bindings/claude-1', 'a/journal.tsv', 'a/session']);
});
