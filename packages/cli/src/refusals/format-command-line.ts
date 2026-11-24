import { quoteShellWord } from './quote-shell-word.ts';

// Writes `www` and each argument, quoted so a shell reads each back as typed. A placeholder for one
// id, name or reference stays bare and a text placeholder, such as <claim>, is quoted, as the
// design's examples show. A word the agent typed is always quoted, even if it reads like a placeholder.
export function formatCommandLine(argv: readonly string[], typedWords: readonly string[]): string {
  return ['www', ...argv.map((argument) => formatArgument(argument, typedWords))].join(' ');
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

// A flag joined to a value that starts with a dash prints as --flag="<value>", the form a refusal
// tells the agent to type.
function formatArgument(argument: string, typedWords: readonly string[]): string {
  const joined = /^(?<flag>--[a-z][a-z-]*=)(?<value>-.*)$/su.exec(argument)?.groups;
  const flag = joined?.['flag'];
  const value = joined?.['value'];

  if (flag !== undefined && value !== undefined) {
    const quoted = quoteShellWord(value);

    return `${flag}${quoted === value ? `"${quoted}"` : quoted}`;
  }

  return bareWords.has(argument) && !typedWords.includes(argument)
    ? argument
    : quoteShellWord(argument);
}
