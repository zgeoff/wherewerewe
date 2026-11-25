import { expect, test } from 'bun:test';
import { formatDisplayPath } from './format-display-path.ts';

function setupTest() {
  return { show: formatDisplayPath };
}

test.each([
  { path: '/people/sam/.claude/settings.json', shown: '~/.claude/settings.json' },
  { path: '/people/sam', shown: '~' },
  { path: '/data/claude/settings.json', shown: '/data/claude/settings.json' },
  { path: '/people/samuel/x', shown: '/people/samuel/x' },
])('it shows $path as $shown', (row) => {
  const ctx = setupTest();

  expect(ctx.show(row.path, '/people/sam')).toBe(row.shown);
});
