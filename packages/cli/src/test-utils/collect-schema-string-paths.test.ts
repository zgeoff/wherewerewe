import { expect, test } from 'bun:test';
import { z } from 'zod';
import { collectSchemaStringPaths } from './collect-schema-string-paths.ts';

function setupTest() {
  return { collectSchemaStringPaths };
}

test('it gives the path of each free string through objects, arrays, nullables and unions', () => {
  const ctx = setupTest();
  const first = z.strictObject({ kind: z.literal('a'), text: z.string().nullable() });
  const second = z.strictObject({ kind: z.literal('b'), tags: z.array(z.string()).optional() });

  const schema = z.strictObject({
    version: z.literal(1),
    name: z.string(),
    by: z.enum(['agent', 'owner']),
    count: z.number(),
    rows: z.array(z.discriminatedUnion('kind', [first, second])),
  });

  expect(ctx.collectSchemaStringPaths(schema)).toStrictEqual([
    'name',
    'rows.[].text',
    'rows.[].tags.[]',
  ]);
});
