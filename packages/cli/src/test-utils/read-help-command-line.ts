// The text after `www` of a command's own line in the help text, with a wrapped line joined and,
// where a line holds several commands, only the command's part. Null when the help has no line.
export function readHelpCommandLine(helpText: string, command: string): string | null {
  const lines = helpText.replaceAll(/\n\s+(?=--)/gu, ' ').split('\n');

  const parts = lines.flatMap((line) =>
    line.split(/\s{3,}|:\s+(?=www )/u).map((part) => part.trim()),
  );

  const found = parts.find(
    (part) => part === `www ${command}` || part.startsWith(`www ${command} `),
  );

  return found === undefined ? null : found.slice('www '.length);
}
