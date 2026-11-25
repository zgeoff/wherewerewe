import { findCredentialMatch } from '../rules/find-credential-match.ts';
import { lineBreakPattern } from '../rules/line-break-pattern.ts';
import { noSecretPlaceholder } from '../rules/redact-credential.ts';
import { redactJoinedCredentials } from '../rules/redact-joined-credentials.ts';
import type { Refusal, RunLine, UpgradeRun } from '../types.ts';
import { formatCommandLine } from './format-command-line.ts';
import { pickUpgradeRun } from './pick-upgrade-run.ts';
import { quoteShellWord } from './quote-shell-word.ts';
import { toPrintedWords } from './to-printed-words.ts';

export interface RefusalScope {
  readonly sessionFlag: string | null;

  // whether the refused command writes, so its last Run line says that nothing was written
  readonly writes: boolean;

  // the line that upgrades this www, for a run of the kind `upgrade`; the install script's when
  // the scope holds none
  readonly upgradeRun?: UpgradeRun;
}

export const nothingWrittenComment = '  # nothing was written';

// Prints the refusal's lines, then each run as `Run: <line>`, each line ending in a newline. The last
// Run line of a refused write ends with a shell comment that says nothing was written. Every
// word of a Run line is quoted, so each Run line is one output line whatever its words hold.
export function formatRefusal(refusal: Refusal, scope: RefusalScope): string {
  const runs = refusal.runs.map((run, at) => {
    const comment = scope.writes && at === refusal.runs.length - 1 ? nothingWrittenComment : '';

    return `Run: ${formatRun(run, scope)}${comment}`;
  });

  return [...refusal.lines, ...runs].map((line) => `${line}\n`).join('');
}

function formatRun(run: RunLine, scope: RefusalScope): string {
  if ('upgrade' in run) {
    return formatRun(scope.upgradeRun ?? pickUpgradeRun('', '', ''), scope);
  }

  if ('shell' in run) {
    return formatShellWords(run.shell);
  }

  if ('pipeline' in run) {
    return run.pipeline.map((words) => formatShellWords(words)).join(' | ');
  }

  if ('usage' in run) {
    const command = formatCommandLine(toPrintedWords([], scope.sessionFlag));

    return run.usage === '' ? command : `${command} ${run.usage}`;
  }

  return formatCommandLine(toPrintedWords(run.www, scope.sessionFlag));
}

function formatShellWords(words: readonly string[]): string {
  return words.map((word) => formatShellWord(word)).join(' ');
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
