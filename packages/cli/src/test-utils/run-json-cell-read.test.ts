import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { runJsonCellRead } from './run-json-cell-read.ts';

function setupTest() {
  return { root: createTempDir('run-json-cell-read').path, runJsonCellRead };
}

test('it reads the seeded store with --json and gives the cell it was given', async () => {
  const ctx = setupTest();

  const printed = await ctx.runJsonCellRead(ctx.root, { goal: 'A goal of its own' }, []);

  expect({ exitCode: printed.exitCode, goal: JSON.parse(printed.stdout).goal }).toStrictEqual({
    exitCode: 0,
    goal: 'A goal of its own',
  });
});

test('it seeds a store of its own for each read', async () => {
  const ctx = setupTest();

  await ctx.runJsonCellRead(ctx.root, { goal: 'First' }, []);

  const second = await ctx.runJsonCellRead(ctx.root, {}, []);

  expect(JSON.parse(second.stdout).goal).toBe('Ship the tide chart');
});
