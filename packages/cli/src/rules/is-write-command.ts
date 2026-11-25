const readOnlyCommands: ReadonlySet<string> = new Set([
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

// Whether a command writes when it runs. The reads, `www sessions`, `www help`, `www doctor`,
// `www hook` and `www goal --paste` write no store. `install` writes the host's settings files.
export function isWriteCommand(command: string, isPaste: boolean): boolean {
  return !readOnlyCommands.has(command) && !(command === 'goal' && isPaste);
}
