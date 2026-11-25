const readCommands: ReadonlySet<string> = new Set([
  'brief',
  'show',
  'log',
  'list',
  'recap',
  'sessions',
  'help',
  'doctor',
  'hook',
]);

// Whether a command only reads, so its refusal ends with no comment that says nothing was written.
export function isReadCommand(command: string): boolean {
  return readCommands.has(command);
}
