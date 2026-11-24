import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { normaliseWords } from '../rules/normalise-words.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import type { RunWord } from '../types.ts';
import { toPlaceholder } from './to-placeholder.ts';

// A Run line's words as printed: with the typed --session, each line break as a space, and each
// credential as the placeholder. A joined flag before `--` keeps its flag, as `--may "<…>"`. A word
// after `--` is one positional, never split or read as a flag.
export function toPrintedWords(www: readonly RunWord[], sessionFlag: string | null): RunWord[] {
  const endOfFlags = www.indexOf('--');
  const flagWords = endOfFlags === -1 ? www : www.slice(0, endOfFlags);

  const isScoped =
    sessionFlag !== null &&
    !flagWords.some(
      (word) => typeof word === 'string' && (word === '--session' || word.startsWith('--session=')),
    );

  const words = isScoped ? ['--session', sessionFlag, ...www] : www;
  const printedEnd = words.indexOf('--');

  return words.flatMap((word, at) =>
    typeof word === 'string'
      ? redactWord(normaliseWords(word), printedEnd !== -1 && at > printedEnd)
      : [word],
  );
}

function redactWord(word: string, isPositional: boolean): RunWord[] {
  if (findCredentialMatch(word) === null) {
    return [word];
  }

  const flag = isPositional ? undefined : /^(?<flag>--[a-z][a-z-]*)=/u.exec(word)?.groups?.['flag'];
  const placeholder = toPlaceholder(noSecretPlaceholder);

  return flag === undefined ? [placeholder] : [flag, placeholder];
}
