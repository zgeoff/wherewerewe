import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { credentialPatterns, findCredentialMatch } from './find-credential-match.ts';
import { redactCredentialWords } from './redact-credential-words.ts';

test.each(buildCredentialSamples().map((entry) => [entry.name, entry.sample, entry.tail] as const))(
  'it leaves nothing the credential test matches, and no part of the %s sample, in each place a line holds it',
  (_name, sample, tail) => {
    const lines = [
      sample,
      `www: unknown command "${sample}".`,
      `www: unknown flag "--${sample}".`,
      `Run: www task t-a --note=${sample}`,
      `(${sample}), [${sample}]; {${sample}}`,
      `  t-a  ${sample}${sample}`,
    ].map((line) => redactCredentialWords(line));

    expect({
      matched: lines.filter((line) => findCredentialMatch(line) !== null),
      leaked: lines.filter((line) => line.includes(tail)),
    }).toStrictEqual({ matched: [], leaked: [] });
  },
);

test.each([
  [
    'a credential that spans a semicolon',
    `www: unknown command "${['ops', '_1234567890;1234567890'].join('')}".`,
    'www: unknown command "<where the secret lives>".',
  ],
  [
    'a bare prefix',
    `www: unknown command "${['ghp', '_'].join('')}".`,
    'www: unknown command "<where the secret lives>".',
  ],
  [
    'a credential in a sentence',
    `use ${['xoxb', '-12345'].join('')}, then wait.`,
    'use <where the secret lives>, then wait.',
  ],
])('it replaces %s and keeps the text around it', (_title, line, expected) => {
  expect(redactCredentialWords(line)).toBe(expected);
});

test('it leaves the name of each pattern in place', () => {
  const names = credentialPatterns.map((entry) => entry.name);

  expect(
    names.map((name) => redactCredentialWords(`(it matches the ${name} pattern)`)),
  ).toStrictEqual(names.map((name) => `(it matches the ${name} pattern)`));
});
