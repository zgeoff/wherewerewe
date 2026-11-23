// Writes `www` and each argument, quoting an argument that is empty or holds whitespace or a
// character the shell reads.
export function formatCommandLine(argv: readonly string[]): string {
  return ['www', ...argv.map((argument) => quoteArgument(argument))].join(' ');
}

// Placeholders that stand for one id, name or reference. A text placeholder, such as <claim>, is
// quoted like any other text, as the design's examples show.
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

function quoteArgument(argument: string): string {
  if (bareWords.has(argument)) {
    return argument;
  }

  const needsQuotes =
    argument === '' || /[\s"'$`\\;&|()*?!{}[\]~]/u.test(argument) || /^<.*>$/u.test(argument);

  return needsQuotes
    ? `"${argument.replaceAll(/(?<special>["$`\\])/gu, String.raw`\$<special>`)}"`
    : argument;
}
