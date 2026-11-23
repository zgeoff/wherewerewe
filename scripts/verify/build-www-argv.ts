import { join } from 'node:path';

const cliPath = join(import.meta.dir, '..', '..', 'packages', 'cli', 'src', 'cli.ts');

// The argv that runs the real `www` as a process, with HOME and XDG_STATE_HOME inside the run's
// state folder under .wringer/, so a journey never reads or writes the owner's stores or settings.
export function buildWWWArgv(stateRoot: string, argv: readonly string[]): readonly string[] {
  return [
    'env',
    `HOME=${join(stateRoot, 'home')}`,
    `XDG_STATE_HOME=${join(stateRoot, 'state')}`,
    'bun',
    cliPath,
    ...argv,
  ];
}
