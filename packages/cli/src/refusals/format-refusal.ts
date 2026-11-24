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
    ? run.shell.map((word) => quoteShellWord(word)).join(' ')
    : formatCommandLine(toPrintedWords(run.www, scope.sessionFlag));
}
