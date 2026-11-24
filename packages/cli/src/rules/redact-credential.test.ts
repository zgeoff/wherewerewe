import { expect, test } from 'bun:test';
import { redactCredential } from './redact-credential.ts';

test('it replaces text that looks like a credential with a placeholder', () => {
  expect(redactCredential(`AKIA${'Q'.repeat(16)}`)).toBe('<where the secret lives>');
});

test('it keeps text that does not look like a credential', () => {
  expect(redactCredential('merge yourself')).toBe('merge yourself');
});
