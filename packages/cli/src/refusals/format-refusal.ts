import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { lineBreakPattern } from '../rules/line-break-pattern.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import { redactJoinedCredentials } from '../rules/redact-joined-credentials.ts';
import type { Refusal, RunLine } from '../types.ts';
import { formatCommandLine } from './format-command-line.ts';
import { quoteShellWord } from './quote-shell-word.ts';
import { toPrintedWords } from './to-printed-words.ts';

export interface RefusalScope {
  readonly sessionFlag: string | null;
}

// Prints the refusal's lines, then each run as `Run: <line>`, each line ending in a newline. Every
// word of a Run line is quoted, so each Run line is one output line whatever its words hold.
export function formatRefusal(refusal: Refusal, scope: RefusalScope): string {
  const runs = refusal.runs.map((run) => `Run: ${formatRun(run, scope)}`);

  return [...refusal.lines, ...runs].map((line) => `${line}\n`).join('');
}

function formatRun(run: RunLine, scope: RefusalScope): string {
  return 'shell' in run
    ? run.shell.map((word) => formatShellWord(word)).join(' ')
    : formatCommandLine(toPrintedWords(run.www, scope.sessionFlag));
}

// A word whose quoted form the credential test matches prints as the quoted placeholder, so the
// output's redaction never splits a quote off it. Quoting turns a line break into an escape, so the
// test also runs on the word before quoting, where a line break cannot split a credential.
function formatShellWord(word: string): string {
  const quoted = quoteShellWord(word);

  return findCredentialMatch(quoted) === null &&
    redactJoinedCredentials(word, lineBreakPattern) === word
    ? quoted
    : quoteShellWord(noSecretPlaceholder);
}
