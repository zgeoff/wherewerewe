import { expect, test } from 'bun:test';
import { credentialPatterns, findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildCredentialSamples } from './build-credential-samples.ts';

test('it builds one sample for each pattern of the credential test, which that pattern matches first', () => {
  const samples = buildCredentialSamples();

  expect({
    names: samples.map((entry) => entry.name).toSorted(),
    matched: samples.map((entry) => findCredentialMatch(entry.sample)),
  }).toStrictEqual({
    names: credentialPatterns.map((entry) => entry.name).toSorted(),
    matched: samples.map((entry) => entry.name),
  });
});

test('it builds each tail so that the tail alone is no credential', () => {
  const tails = buildCredentialSamples().map((entry) => findCredentialMatch(entry.tail));

  expect(tails).toSatisfyAll((match: string | null) => match === null);
});
