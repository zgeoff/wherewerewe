import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { findCredentialMatch, findCredentialSpan } from './find-credential-match.ts';

test.each(buildCredentialSamples().map((entry) => [entry.name, `token ${entry.sample}`] as const))(
  'it names the %s pattern in a text that holds its sample',
  (name, text) => {
    expect(findCredentialMatch(text)).toStrictEqual(name);
  },
);

test.each([
  ['The staging secrets live in the vault bosun-staging'],
  ['sk-short'],
  ['AKIA1234'],
  ['ops_short'],
  ['Retry a 503 from the tide feed 3 times'],
])('it finds no credential in %s', (text) => {
  expect(findCredentialMatch(text)).toBeNull();
});

test('it finds the earliest place any pattern matches, with its end', () => {
  const text = ['see ', 'xo', 'xb-12 and ', 'gh', 'p_34'].join('');

  expect(findCredentialSpan(text)).toStrictEqual({ start: 4, end: 9 });
});

test('it finds no place in a text with no credential', () => {
  expect(findCredentialSpan('Retry a 503 from the tide feed 3 times')).toBeNull();
});
