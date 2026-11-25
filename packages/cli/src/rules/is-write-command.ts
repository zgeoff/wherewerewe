const readOnlyCommands: ReadonlySet<string> = new Set([
  'brief',
  'show',
  'log',
  'list',
  'recap',
  'sessions',
  'help',
]);

// Whether a command writes when it runs. The reads, `www sessions`, `www help` and
// `www goal --paste` write nothing.
export function isWriteCommand(command: string, isPaste: boolean): boolean {
  return !readOnlyCommands.has(command) && !(command === 'goal' && isPaste);
}
