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
