import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import type { RunWord } from '../types.ts';
import { toPlaceholder } from './to-placeholder.ts';

// A typed value as a Run line holds it: the value, or the placeholder for where the secret lives
// when the credential test matches it.
export function toRedactedRunWord(value: string): RunWord {
  return findCredentialMatch(value) === null ? value : toPlaceholder(noSecretPlaceholder);
}
