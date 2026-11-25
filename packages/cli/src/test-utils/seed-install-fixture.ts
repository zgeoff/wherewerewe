import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { findHomePaths } from '../install/find-home-paths.ts';
import type { HomePaths } from '../install/find-home-paths.ts';
import { runCLI } from '../run-cli.ts';
import type { CLIResult } from '../types.ts';
import { seedStubCommand } from './seed-stub-command.ts';

export interface InstallFixture {
  readonly root: string;
  readonly home: string;
  readonly work: string;
  readonly bin: string;
  readonly storeRoot: string;
  readonly env: Readonly<Record<string, string>>;
  readonly paths: HomePaths;
  readonly run: (
    argv: readonly string[],
    extraEnv?: Readonly<Record<string, string>>,
  ) => Promise<CLIResult>;
}

// A temp home with a stub `wherewerewe` (a file that is no script, as a compiled binary is), a
// `codex` that decides `allow` and a `gh` that is signed in, all on a PATH that holds only their
// folder. Nothing of the machine's own home, PATH or state is read or written.
export function seedInstallFixture(): InstallFixture {
  const root = createTempDir('install-fixture').path;
  const bin = join(root, 'bin');
  const home = join(root, 'home');
  const work = join(root, 'work');

  mkdirSync(home, { recursive: true });
  mkdirSync(work, { recursive: true });
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, 'wherewerewe'), 'binary-stub');
  chmodSync(join(bin, 'wherewerewe'), 0o755);
  seedStubCommand(bin, 'codex', `echo '{"decision":"allow","matchedRules":[]}'`);
  seedStubCommand(bin, 'gh', 'exit 0');

  const env = { HOME: home, XDG_STATE_HOME: join(root, 'state'), PATH: bin };
  const paths = findHomePaths(env);

  if (paths === null) {
    throw new Error('the fixture has a home');
  }

  return {
    root,
    home,
    work,
    bin,
    storeRoot: join(root, 'state', 'wherewerewe'),
    env,
    paths,
    run: (argv, extraEnv = {}) =>
      runCLI({
        argv,
        env: { ...env, ...extraEnv },
        cwd: work,
        terminal: { stdin: false, stdout: false },
        now: () => Date.parse('2026-03-10T11:43:00Z'),
      }),
  };
}
