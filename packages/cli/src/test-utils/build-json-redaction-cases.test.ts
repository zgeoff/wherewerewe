import { expect, test } from 'bun:test';
import { buildJsonRedactionCases } from './build-json-redaction-cases.ts';
import { plainCells } from './seed-json-cells-store.ts';

function setupTest() {
  return { buildJsonRedactionCases, cases: buildJsonRedactionCases() };
}

test('it names each cell once, as a cell the seeder holds, with at least one read', () => {
  const ctx = setupTest();
  const cells = ctx.cases.map((found) => found.cell);

  expect({
    unique: new Set(cells).size,
    unknown: cells.filter((cell) => plainCells[cell] === undefined),
    withNoRead: ctx.cases.filter((found) => found.reads.length === 0).map((found) => found.cell),
  }).toStrictEqual({ unique: cells.length, unknown: [], withNoRead: [] });
});

test('it gives each cell a limit that holds its plain text', () => {
  const ctx = setupTest();

  expect(
    ctx.cases
      .filter(
        (found) =>
          Array.from(plainCells[found.cell] ?? '', (character) => character).length > found.limit,
      )
      .map((found) => found.cell),
  ).toStrictEqual([]);
});

test.each(['brief', 'show', 'log', 'list', 'recap'] as const)(
  'it holds a case with a read of the %s shape',
  (shape) => {
    const ctx = setupTest();

    expect(ctx.cases.some((found) => found.reads.some((read) => read.shape === shape))).toBe(true);
  },
);

test('it gives each read the argv of its shape', () => {
  const ctx = setupTest();

  const wrong = ctx.cases.flatMap((found) =>
    found.reads
      .filter((read) =>
        read.shape === 'brief' ? read.argv.length > 0 : read.argv[0] !== read.shape,
      )
      .map((read) => `${found.cell}: ${read.argv.join(' ')}`),
  );

  expect(wrong).toStrictEqual([]);
});
