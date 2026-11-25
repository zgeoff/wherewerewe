import { expect, test } from 'bun:test';
import { readDesignBlock } from './read-design-block.ts';

function setupTest() {
  return { readDesignBlock };
}

test('it reads the text block under a heading of a design doc', () => {
  const ctx = setupTest();
  const block = ctx.readDesignBlock('lists-and-json.md', '### www goal --paste', 'text');

  expect(block).toStartWith('$ www --session tide-alerts goal --paste\n');
});

test('it reads the ts block under a heading of a design doc', () => {
  const ctx = setupTest();
  const block = ctx.readDesignBlock('lists-and-json.md', '### --json', 'ts');

  expect(block).toInclude('interface BriefJson {');
});

test('it reads nothing from a heading the doc lacks', () => {
  const ctx = setupTest();

  expect(ctx.readDesignBlock('lists-and-json.md', '### no such heading', 'text')).toBe('');
});
