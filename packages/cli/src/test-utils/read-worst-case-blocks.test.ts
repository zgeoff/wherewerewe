import { expect, test } from 'bun:test';
import { readWorstCaseBlocks } from './read-worst-case-blocks.ts';

function setupTest() {
  return { read: readWorstCaseBlocks };
}

test('it reads the 17 blocks of the worst-case table and a total that is their sum', () => {
  const ctx = setupTest();
  const table = ctx.read();

  expect({
    count: table.blocks.length,
    first: table.blocks[0],
    isSum: table.blocks.reduce((sum, block) => sum + block.bytes, 0) === table.totalBytes,
  }).toStrictEqual({ count: 17, first: { label: 'header', bytes: 206 }, isSum: true });
});
