import type { Refusal, RunLine } from '../types.ts';
import { formatCommandLine } from './format-command-line.ts';

interface RefusalScope {
  readonly sessionFlag: string | null;
}

// Prints the refusal's lines, then each run as `Run: <line>`, each line ending in a newline. When
// the agent typed --session, each www run line keeps it.
export function formatRefusal(refusal: Refusal, typed: RefusalScope): string {
  const runs = refusal.runs.map((run) => `Run: ${formatRun(run, typed.sessionFlag)}`);

  return [...refusal.lines, ...runs].map((line) => `${line}\n`).join('');
}

function formatRun(run: RunLine, sessionFlag: string | null): string {
  if ('shell' in run) {
    return run.shell;
  }

  const isScoped = sessionFlag !== null && !run.www.includes('--session');
  const words = isScoped ? ['--session', sessionFlag, ...run.www] : run.www;

  return formatCommandLine(words);
}
