import { quoteShellWord } from './quote-shell-word.ts';

// Writes `www` and each argument, quoted so a shell reads each back as typed. A placeholder that
// stands for one id, name or reference stays bare, and a text placeholder, such as <claim>, is
// quoted like any other text, as the design's examples show.
export function formatCommandLine(argv: readonly string[]): string {
  return ['www', ...argv.map((argument) => formatArgument(argument))].join(' ');
}

const bareWords: ReadonlySet<string> = new Set([
  '<new id>',
  '<open id>',
  '<id>',
  '<name>',
  '<owner>/<repo>#<number>',
  '<absolute repo path>@<branch>',
  '<process id>',
  '<absolute path>',
]);

function formatArgument(argument: string): string {
  return bareWords.has(argument) ? argument : quoteShellWord(argument);
}
