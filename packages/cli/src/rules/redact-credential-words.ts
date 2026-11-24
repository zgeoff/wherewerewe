import { findCredentialSpan } from './find-credential-match.ts';
import type { CredentialSpan } from './find-credential-match.ts';
import { noSecretPlaceholder } from './redact-credential.ts';

// Replaces each credential match, with the rest of its word, by the placeholder until no match is
// left, so no output line holds text a write would refuse. The replaced part holds the whole match,
// even one that runs past a space, quote, bracket, comma or semicolon, where a word ends.
export function redactCredentialWords(text: string): string {
  const span = findCredentialSpan(text);

  if (span === null) {
    return text;
  }

  const matchEnd = getMatchEnd(text, span);
  const start = getWordStart(text, span.start);
  const end = getWordEnd(text, matchEnd);

  return redactCredentialWords(`${text.slice(0, start)}${noSecretPlaceholder}${text.slice(end)}`);
}

// A pattern such as ops_ followed by 20 characters takes any run of non-spaces, so its match can
// end in the quote or the full stop that closes a sentence. The match gives those back while what
// is left still matches, so the line keeps them.
function getMatchEnd(text: string, span: CredentialSpan): number {
  const last = text.charAt(span.end - 1);
  const shorter = text.slice(span.start, span.end - 1);

  return /[\s"'`()[\]{},;.:!?]/u.test(last) && findCredentialSpan(shorter) !== null
    ? getMatchEnd(text, { start: span.start, end: span.end - 1 })
    : span.end;
}

function getWordStart(text: string, from: number): number {
  const last = [...text.slice(0, from).matchAll(/[\s"'`()[\]{},;]/gu)].at(-1);

  return last === undefined ? 0 : last.index + last[0].length;
}

function getWordEnd(text: string, from: number): number {
  const stop = text.slice(from).search(/[\s"'`()[\]{},;]/u);

  return stop === -1 ? text.length : from + stop;
}
