import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildCredentialFieldArbitrary } from './build-credential-field-arbitrary.ts';
import { buildJsonRedactionCases } from './build-json-redaction-cases.ts';

function setupTest() {
  return { buildCredentialFieldArbitrary, cases: buildJsonRedactionCases() };
}

test.each(['brief', 'show', 'log', 'list', 'recap'] as const)(
  'it builds for the %s shape a value with a credential, within its limit, and the value printed',
  (shape) => {
    const ctx = setupTest();

    const generated = fc.sample(ctx.buildCredentialFieldArbitrary(ctx.cases, shape), {
      numRuns: 200,
      seed: 1,
    });

    const limits = new Map(ctx.cases.map((found) => [found.cell, found.limit]));

    expect({
      shapes: generated.filter((one) => one.read.shape !== shape).length,
      noCredential: generated.filter((one) => findCredentialMatch(one.value) === null).length,
      overLimit: generated.filter((one) => one.value.length > (limits.get(one.cell) ?? 0)).length,
      leftBehind: generated.filter((one) => one.expected.includes(one.tail)).length,
      placed: generated.filter((one) => !one.expected.includes('<where the secret lives>')).length,
    }).toStrictEqual({ shapes: 0, noCredential: 0, overLimit: 0, leftBehind: 0, placed: 0 });
  },
);

test('it builds no ; or = into a cell that refuses them', () => {
  const ctx = setupTest();

  const separated = new Set(
    ctx.cases.filter((found) => found.isSeparated).map((found) => found.cell),
  );

  const generated = fc
    .sample(ctx.buildCredentialFieldArbitrary(ctx.cases, 'brief'), { numRuns: 300, seed: 2 })
    .filter((one) => separated.has(one.cell) && /[;=]/u.test(one.value));

  expect(generated).toStrictEqual([]);
});
