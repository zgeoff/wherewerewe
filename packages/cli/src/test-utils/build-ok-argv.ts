// An ok of the approval ok-merge with every part, and the flags the test adds after them.
export function buildOkArgv(...flags: readonly string[]): string[] {
  return [
    'ok',
    'ok-merge',
    '--quote',
    'merge the alert PRs yourself',
    '--who',
    'owner',
    '--where',
    'terminal',
    '--scope',
    'bosun-api',
    ...flags,
  ];
}
