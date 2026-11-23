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

const unscopedCommands: ReadonlySet<string> = new Set([
  'init',
  'attach',
  'detach',
  'sessions',
  'help',
  'import',
]);

function formatRun(run: RunLine, sessionFlag: string | null): string {
  if ('shell' in run) {
    return run.shell;
  }

  const command = getCommand(run.www);

  const isScoped =
    sessionFlag !== null && !run.www.includes('--session') && !unscopedCommands.has(command);

  const words = isScoped ? ['--session', sessionFlag, ...run.www] : run.www;

  return formatCommandLine(words);
}

function getCommand(argv: readonly string[]): string {
  const terminator = argv.indexOf('--');

  if (terminator !== -1) {
    return argv[terminator + 1] ?? '';
  }

  return argv.find((word) => !word.startsWith('-')) ?? '';
}
