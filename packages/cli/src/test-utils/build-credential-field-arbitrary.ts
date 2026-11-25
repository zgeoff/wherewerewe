import fc from 'fast-check';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildCredentialSamples } from './build-credential-samples.ts';
import type { JsonRedactionCase, JsonRedactionRead } from './build-json-redaction-cases.ts';

export interface CredentialFieldCase {
  readonly cell: string;
  readonly read: JsonRedactionRead;

  // the value the cell holds, with the credential in it
  readonly value: string;

  // the value as the output prints it, with the placeholder where the credential sat
  readonly expected: string;

  // the part of the credential after its prefix
  readonly tail: string;
}

const wordCharacters = [...'abcdefghijklmnopqrstuvwxyz0123456789'];

// A cell, a read that prints it, a credential sample, and the plain words around it: the sample is
// a word of its own at the start, inside or at the end of the value, within the cell's limit. A cell
// shorter than a sample takes the start of it that a pattern still matches.
export function buildCredentialFieldArbitrary(
  cases: readonly JsonRedactionCase[],
  shape: JsonRedactionRead['shape'],
): fc.Arbitrary<CredentialFieldCase> {
  const pairs = cases.flatMap((found) =>
    found.reads.filter((read) => read.shape === shape).map((read) => ({ found, read })),
  );

  const word = fc.string({ unit: fc.constantFrom(...wordCharacters), minLength: 1, maxLength: 6 });

  return fc
    .record({
      pair: fc.constantFrom(...pairs),
      rotation: fc.nat({ max: 19 }),
      sampleAt: fc.nat(),
      words: fc.array(word, { maxLength: 8 }),
      at: fc.nat(),
    })
    .map((generated) => buildCase(generated));
}

interface Generated {
  readonly pair: { readonly found: JsonRedactionCase; readonly read: JsonRedactionRead };
  readonly rotation: number;
  readonly sampleAt: number;
  readonly words: readonly string[];
  readonly at: number;
}

const placeholder = '<where the secret lives>';

function buildCase(generated: Generated): CredentialFieldCase {
  const found = generated.pair.found;

  const fitting = buildCredentialSamples(generated.rotation)
    .map((entry) => {
      const sample = entry.sample.slice(0, found.limit);

      return { sample, tail: sample.slice(entry.sample.length - entry.tail.length) };
    })
    .filter(
      (entry) =>
        findCredentialMatch(entry.sample) !== null &&
        entry.tail.length >= 4 &&
        !(found.isSeparated && /[;=]/u.test(entry.sample)),
    );

  const credential = fitting[generated.sampleAt % fitting.length] ?? { sample: '', tail: '' };
  const kept: string[] = [];
  let used = credential.sample.length;

  for (const word of generated.words) {
    if (used + word.length + 1 <= found.limit) {
      kept.push(word);

      used += word.length + 1;
    }
  }

  const at = generated.at % (kept.length + 1);
  const place = (middle: string) => [...kept.slice(0, at), middle, ...kept.slice(at)].join(' ');

  return {
    cell: found.cell,
    read: generated.pair.read,
    value: place(credential.sample),
    expected: place(placeholder),
    tail: credential.tail,
  };
}
