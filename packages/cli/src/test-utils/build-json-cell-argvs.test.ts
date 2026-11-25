import { expect, test } from 'bun:test';
import { listKinds } from '../rules/list-kinds.ts';
import { buildJsonCellArgvs } from './build-json-cell-argvs.ts';

function setupTest() {
  return { buildJsonCellArgvs };
}

test('it reads each shape, and a list of every kind', () => {
  const ctx = setupTest();
  const argvs = ctx.buildJsonCellArgvs();

  expect({
    shapes: [...new Set(argvs.map((read) => read.shape))],
    lists: argvs.flatMap((read) => (read.shape === 'list' ? [read.argv[1]] : [])),
  }).toStrictEqual({
    shapes: ['brief', 'show', 'log', 'list', 'recap'],
    lists: [...listKinds],
  });
});
