import type { RunWord } from '../types.ts';
import { quoteShellWord } from './quote-shell-word.ts';

// Writes `www` and each argument, quoted so a shell reads each back as one word. A placeholder for
// an id, name or reference stays bare and a text placeholder, such as <claim>, is quoted, as the
// design's examples show. A value is quoted when it needs it, even one that reads like a placeholder.
export function formatCommandLine(argv: readonly RunWord[]): string {
  const endOfFlags = argv.indexOf('--');

  return [
    'www',
    ...argv.map((argument, at) =>
      formatRunArgument(argument, endOfFlags !== -1 && at > endOfFlags),
    ),
  ].join(' ');
}

export const barePlaceholders: ReadonlySet<string> = new Set([
  '<new id>',
  '<open id>',
  '<id>',
  '<name>',
  '<owner>/<repo>#<number>',
  '<absolute repo path>@<branch>',
  '<process id>',
  '<absolute path>',
]);

// A flag before `--` joined to a value that starts with a dash prints as --flag="<value>", the form
// a refusal tells the agent to type.
export function formatRunArgument(argument: RunWord, isPositional: boolean): string {
  if (typeof argument !== 'string') {
    return barePlaceholders.has(argument.placeholder)
      ? argument.placeholder
      : quoteShellWord(argument.placeholder);
  }

  const joined = isPositional
    ? undefined
    : /^(?<flag>--[a-z][a-z-]*=)(?<value>-.*)$/su.exec(argument)?.groups;

  const flag = joined?.['flag'];
  const value = joined?.['value'];

  if (flag !== undefined && value !== undefined) {
    const quoted = quoteShellWord(value);

    return `${flag}${quoted === value ? `"${quoted}"` : quoted}`;
  }

  return quoteShellWord(argument);
}
