import type { Refusal, RunLine } from '../types.ts';
import { formatCommandLine } from './format-command-line.ts';
import { toPrintedWords } from './to-printed-words.ts';

export interface RefusalScope {
  readonly sessionFlag: string | null;

  // every word the agent typed, so a value that reads like a placeholder is still quoted
  readonly typedWords: readonly string[];
}

// Prints the refusal's lines, then each run as `Run: <line>`, each line ending in a newline.
export function formatRefusal(refusal: Refusal, typed: RefusalScope): string {
  const runs = refusal.runs.map((run) => `Run: ${formatRun(run, typed)}`);

  return [...refusal.lines, ...runs].map((line) => `${line}\n`).join('');
}

function formatRun(run: RunLine, typed: RefusalScope): string {
  return 'shell' in run
    ? run.shell
    : formatCommandLine(toPrintedWords(run.www, typed.sessionFlag), typed.typedWords);
}
