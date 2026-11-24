import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { joinSplitLines } from '../rules/join-split-lines.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import type { RunWord } from '../types.ts';
import { toPlaceholder } from './to-placeholder.ts';

// A typed value as a Run line holds it: the value, or the placeholder for where the secret lives
// when the credential test matches it, or matches it with its line breaks joined, because a Run
// line prints each line break as a space.
export function toRedactedRunWord(value: string): RunWord {
  const isCredential =
    findCredentialMatch(value) !== null || findCredentialMatch(joinSplitLines(value)) !== null;

  return isCredential ? toPlaceholder(noSecretPlaceholder) : value;
}
