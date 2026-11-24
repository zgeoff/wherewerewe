import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { normaliseWords } from '../rules/normalise-words.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';

// A Run line's words as printed: with the typed --session, each line break as the space the store
// keeps, and each credential as the placeholder. A joined flag keeps its flag: `--may=ghp_x`
// prints as `--may "<where the secret lives>"`.
export function toPrintedWords(www: readonly string[], sessionFlag: string | null): string[] {
  // a word after -- is a positional, so a --session there is not the flag
  const endOfFlags = www.indexOf('--');
  const flagWords = endOfFlags === -1 ? www : www.slice(0, endOfFlags);

  const isScoped =
    sessionFlag !== null &&
    !flagWords.some((word) => word === '--session' || word.startsWith('--session='));

  const words = isScoped ? ['--session', sessionFlag, ...www] : www;

  return words.flatMap((word) => redactWord(normaliseWords(word)));
}

function redactWord(word: string): string[] {
  if (findCredentialMatch(word) === null) {
    return [word];
  }

  const flag = /^(?<flag>--[a-z][a-z-]*)=/u.exec(word)?.groups?.['flag'];

  return flag === undefined ? [noSecretPlaceholder] : [flag, noSecretPlaceholder];
}
