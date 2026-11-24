import type { CredentialSpan } from './find-credential-match.ts';
import { findRedactedRange } from './find-redacted-range.ts';
import { noSecretPlaceholder } from './redact-credential.ts';

// Redacts, on the raw text, each credential that a joiner character splits, so a caller that turns
// those characters into spaces or escapes afterwards prints no part of it.
export function redactJoinedCredentials(text: string, joiner: RegExp): string {
  const range = findJoinedRange(text, joiner) ?? findRedactedRange(text);

  if (range === null) {
    return text;
  }

  return redactJoinedCredentials(
    `${text.slice(0, range.start)}${noSecretPlaceholder}${text.slice(range.end)}`,
    joiner,
  );
}

// The redacted range of the text with every joiner character left out, mapped back to the raw
// text. A joiner character that a pattern's \S takes can complete a match on the raw text that
// this one falls short of, which is why the caller matches the raw text too.
function findJoinedRange(text: string, joiner: RegExp): CredentialSpan | null {
  const kept = collectKeptCharacters(text, joiner);
  const range = findRedactedRange(kept.map((entry) => entry.character).join(''));

  if (range === null) {
    return null;
  }

  const units = kept.flatMap((entry) =>
    Array.from({ length: entry.character.length }, () => entry),
  );

  const first = units.at(range.start);
  const last = units.at(range.end - 1);

  return {
    start: first === undefined ? 0 : first.at,
    end: last === undefined ? text.length : last.at + last.character.length,
  };
}

interface KeptCharacter {
  readonly character: string;

  // where the character starts in the raw text
  readonly at: number;
}

function collectKeptCharacters(text: string, joiner: RegExp): KeptCharacter[] {
  const kept: KeptCharacter[] = [];
  let at = 0;

  for (const character of text) {
    if (!joiner.test(character)) {
      kept.push({ character, at });
    }

    at += character.length;
  }

  return kept;
}
