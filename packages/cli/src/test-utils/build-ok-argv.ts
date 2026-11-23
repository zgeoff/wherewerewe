// The argv that writes the approval ok-merge, with --once or --standing as given.
export function buildOkArgv(use: '--once' | '--standing'): string[] {
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
    use,
  ];
}
