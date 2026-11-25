import fc from 'fast-check';
import type { JsonRedactionCase, JsonRedactionRead } from './build-json-redaction-cases.ts';

export interface StoredTextCase {
  readonly cell: string;
  readonly read: JsonRedactionRead;
  readonly value: string;
}

const printable = Array.from({ length: 95 }, (_unused, index) =>
  String.fromCodePoint(32 + index),
).filter((character) => character !== ';' && character !== '=');

// A cell, a read that prints it, and any text the store holds in it: printable characters, JSON
// specials, astral characters and near-matches of the ops_ pattern. The text is one line of at most
// the cell's limit in characters, and never empty or a lone dash, which a store reads as no text.
export function buildStoredTextArbitrary(
  cases: readonly JsonRedactionCase[],
  shape: JsonRedactionRead['shape'],
): fc.Arbitrary<StoredTextCase> {
  const pairs = cases.flatMap((found) =>
    found.reads.filter((read) => read.shape === shape).map((read) => ({ found, read })),
  );

  const opsCharacter = fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split(''));

  const fragment = fc.oneof(
    fc.constantFrom(...printable),
    fc.constantFrom('"', '\\', '/', '}', '{', ']', '\u{1F600}', '\u{10348}', 'é', '日本'),
    fc
      .string({
        unit: opsCharacter,
        maxLength: 19,
      })
      .map((rest) => `ops_${rest}`),
  );

  return fc
    .record({ pair: fc.constantFrom(...pairs), fragments: fc.array(fragment, { minLength: 1 }) })
    .map((generated) => ({
      cell: generated.pair.found.cell,
      read: generated.pair.read,
      value: `${generated.pair.found.prefix}a${Array.from(
        generated.fragments.join(''),
        (character) => character,
      )
        .slice(0, generated.pair.found.limit - generated.pair.found.prefix.length - 2)
        .join('')}z`,
    }));
}
