import { findCredentialSpan } from './find-credential-match.ts';
import type { CredentialSpan } from './find-credential-match.ts';

// The part of the text that the redaction replaces: the earliest credential match, with the rest
// of its word. The part holds the whole match, even one that runs past a space, quote, bracket,
// comma or semicolon, where a word ends.
export function findRedactedRange(text: string): CredentialSpan | null {
  const span = findCredentialSpan(text);

  if (span === null) {
    return null;
  }

  return { start: getWordStart(text, span.start), end: getWordEnd(text, getMatchEnd(text, span)) };
}

function getWordStart(text: string, from: number): number {
  const last = [...text.slice(0, from).matchAll(/[\s"'`()[\]{},;]/gu)].at(-1);

  return last === undefined ? 0 : last.index + last[0].length;
}

function getWordEnd(text: string, from: number): number {
  const stop = text.slice(from).search(/[\s"'`()[\]{},;]/u);

  return stop === -1 ? text.length : from + stop;
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
