import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { buildJsonRedactionCases } from './build-json-redaction-cases.ts';
import { buildStoredTextArbitrary } from './build-stored-text-arbitrary.ts';

function setupTest() {
  return { buildStoredTextArbitrary, cases: buildJsonRedactionCases() };
}

test('it builds a line within the limit of its cell, with no tab, line break, ; or =', () => {
  const ctx = setupTest();

  const limits = new Map(ctx.cases.map((found) => [found.cell, found.limit]));

  const generated = fc.sample(ctx.buildStoredTextArbitrary(ctx.cases, 'brief'), {
    numRuns: 300,
    seed: 3,
  });

  expect({
    overLimit: generated.filter((one) => [...one.value].length > (limits.get(one.cell) ?? 0))
      .length,
    broken: generated.filter((one) => /[\t\n\r;=]/u.test(one.value)).length,
    lone: generated.filter((one) => one.value.trim().length < 2).length,
  }).toStrictEqual({ overLimit: 0, broken: 0, lone: 0 });
});

test('it builds an ops_ near-match, a JSON special and an astral character among 600 values', () => {
  const ctx = setupTest();

  const text = fc
    .sample(ctx.buildStoredTextArbitrary(ctx.cases, 'show'), { numRuns: 600, seed: 4 })
    .map((one) => one.value)
    .join('');

  expect({
    ops: text.includes('ops_'),
    quote: text.includes('"'),
    astral: /\p{Extended_Pictographic}|\u{10348}/u.test(text),
  }).toStrictEqual({ ops: true, quote: true, astral: true });
});
