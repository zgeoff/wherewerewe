import { expect, test } from 'bun:test';
import { collectTypeFields } from './collect-type-fields.ts';

function setupTest() {
  return { collectTypeFields };
}

test('it collects the fields of an interface and of a union, nested fields and a comment aside', () => {
  const ctx = setupTest();

  const fields = ctx.collectTypeFields(`
// interface Hidden { gone: string }
export interface Tide {
  readonly harbour: string;
  readonly mark?: { readonly height: number; readonly unit: string }; // unit: metres
}

type Reading =
  | { kind: 'low'; at: string }
  | { kind: 'high'; at: string };
`);

  expect(fields).toStrictEqual({
    Tide: ['harbour', 'height', 'mark', 'unit'],
    Reading: ['at', 'kind'],
  });
});
