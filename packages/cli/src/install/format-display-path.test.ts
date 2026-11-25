import { expect, test } from 'bun:test';
import { formatDisplayPath } from './format-display-path.ts';

function setupTest() {
  return { show: formatDisplayPath };
}

test.each([
  { path: '/home/sam/.claude/settings.json', shown: '~/.claude/settings.json' },
  { path: '/data/claude/settings.json', shown: '/data/claude/settings.json' },
  { path: '/home/samuel/x', shown: '/home/samuel/x' },
])('it shows $path as $shown', (row) => {
  const ctx = setupTest();

  expect(ctx.show(row.path, '/home/sam')).toBe(row.shown);
});
