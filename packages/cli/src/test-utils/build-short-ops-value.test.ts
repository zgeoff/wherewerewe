import { expect, test } from 'bun:test';
import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { buildShortOpsValue } from './build-short-ops-value.ts';

function setupTest() {
  return { build: buildShortOpsValue };
}

test('it builds ops_ and 5 characters, which the credential test does not match', () => {
  const ctx = setupTest();
  const value = ctx.build();

  expect({ length: value.length, match: findCredentialMatch(value) }).toStrictEqual({
    length: 9,
    match: null,
  });
});
