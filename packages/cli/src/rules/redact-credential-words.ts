import { findCredentialMatch, isCredentialLabel } from './find-credential-match.ts';
import { noSecretPlaceholder } from './redact-credential.ts';

// Every word of the text that looks like a credential becomes the placeholder, so no output line
// prints one. A word is a run of characters with no space, quote, bracket, comma or semicolon. The
// bare name of a pattern stays, because a refusal names the pattern that matched.
export function redactCredentialWords(text: string): string {
  return text.replaceAll(/[^\s"'`()[\]{},;]+/gu, (word) =>
    findCredentialMatch(word) === null || isCredentialLabel(word) ? word : noSecretPlaceholder,
  );
}
