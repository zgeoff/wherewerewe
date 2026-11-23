import { findCredentialMatch } from './find-credential-match.ts';

export const noSecretPlaceholder = '<text with no secret in it>';

// The text, or a placeholder when it looks like a credential, so a refusal never prints a secret
// that the agent typed.
export function redactCredential(text: string): string {
  return findCredentialMatch(text) === null ? text : noSecretPlaceholder;
}
