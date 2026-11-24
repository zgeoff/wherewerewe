import { findRedactedRange } from './find-redacted-range.ts';
import { noSecretPlaceholder } from './redact-credential.ts';

// Redacts, on the raw text, each credential that a joiner character splits, so a caller that turns
// those characters into spaces or escapes afterwards prints no part of it. The match runs on the
// text with every joiner character left out, and the placeholder replaces the raw text it spans.
export function redactJoinedCredentials(text: string, joiner: RegExp): string {
  const kept = collectKeptCharacters(text, joiner);
  const range = findRedactedRange(kept.map((entry) => entry.character).join(''));

  if (range === null) {
    return text;
  }

  const units = kept.flatMap((entry) =>
    Array.from({ length: entry.character.length }, () => entry),
  );

  const first = units.at(range.start);
  const last = units.at(range.end - 1);
  const start = first === undefined ? 0 : first.at;
  const end = last === undefined ? text.length : last.at + last.character.length;

  return redactJoinedCredentials(
    `${text.slice(0, start)}${noSecretPlaceholder}${text.slice(end)}`,
    joiner,
  );
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
