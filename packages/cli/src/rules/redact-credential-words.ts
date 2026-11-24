import { findRedactedRange } from './find-redacted-range.ts';
import { noSecretPlaceholder } from './redact-credential.ts';

// Replaces each credential match, with the rest of its word, by the placeholder until no match is
// left, so no output line holds text a write would refuse.
export function redactCredentialWords(text: string): string {
  return text.replaceAll(/\S+/gu, (token) => redactToken(token));
}

// No pattern matches across a space, so each run of non-spaces is redacted on its own, and a long
// output costs one pass.
function redactToken(token: string): string {
  const range = findRedactedRange(token);

  if (range === null) {
    return token;
  }

  return redactToken(
    `${token.slice(0, range.start)}${noSecretPlaceholder}${token.slice(range.end)}`,
  );
}
