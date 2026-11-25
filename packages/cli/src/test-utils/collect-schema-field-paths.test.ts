import { expect, test } from 'bun:test';
import { z } from 'zod';
import { collectSchemaFieldPaths, collectValueFieldPaths } from './collect-schema-field-paths.ts';

function setupTest() {
  const task = z.strictObject({ kind: z.literal('task'), note: z.string().nullable() });
  const place = z.strictObject({ kind: z.literal('where'), note: z.string(), done: z.boolean() });

  const schema = z.strictObject({
    version: z.literal(1),
    rows: z.array(z.discriminatedUnion('kind', [task, place])),
  });

  return { schema, collectSchemaFieldPaths, collectValueFieldPaths };
}

test('#collectSchemaFieldPaths gives every field, with each branch of a discriminated union apart', () => {
  const ctx = setupTest();

  expect(ctx.collectSchemaFieldPaths(ctx.schema)).toStrictEqual([
    'version',
    'rows.[]{kind=task}.kind',
    'rows.[]{kind=task}.note',
    'rows.[]{kind=where}.kind',
    'rows.[]{kind=where}.note',
    'rows.[]{kind=where}.done',
  ]);
});

test('#collectValueFieldPaths gives only the fields that hold a value, under the branch of each row', () => {
  const ctx = setupTest();

  const paths = ctx.collectValueFieldPaths(ctx.schema, {
    version: 1,
    rows: [
      { kind: 'task', note: 'Ask first' },
      { kind: 'task', note: null },
    ],
  });

  expect(paths).toStrictEqual([
    'version',
    'rows.[]{kind=task}.kind',
    'rows.[]{kind=task}.note',
    'rows.[]{kind=task}.kind',
  ]);
});

test('#collectValueFieldPaths gives no path for a field the value leaves out, though the schema requires it', () => {
  const ctx = setupTest();

  const paths = ctx.collectValueFieldPaths(ctx.schema, {
    version: 1,
    rows: [{ kind: 'where', note: 'Stop it at the switch' }],
  });

  expect(paths).toStrictEqual(['version', 'rows.[]{kind=where}.kind', 'rows.[]{kind=where}.note']);
});
