import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import type { Result } from '../types.ts';

interface WwwOptions {
  readonly agent?: string | null;
  readonly stdin?: string;
}

export interface TestHome {
  readonly home: string;
  readonly root: string;

  // runs one command as the host session `agent`, or as a plain terminal when it is null
  readonly www: (argv: readonly string[], options?: WwwOptions) => Promise<Result>;

  // runs a command and parses each line of its JSON reply
  readonly json: (argv: readonly string[]) => Promise<readonly unknown[]>;
}

// A temp home with its own store, so a test never touches a live session's notes. The folder goes
// when the test finishes.
export function createTestHome(): TestHome {
  const home = createTempDir('www-test').path;
  let clock = Date.parse('2026-03-01T09:00:00Z');

  const www: TestHome['www'] = (argv, options = {}) => {
    clock += 1000;

    const agent = options.agent === undefined ? 'host-1' : options.agent;

    return runCLI({
      argv,
      env: { HOME: home, ...(agent === null ? {} : { CLAUDE_CODE_SESSION_ID: agent }) },
      now: () => clock,
      stdin: options.stdin ?? '',
      binaryPath: '/opt/bin/wherewerewe',
      version: '9.9.9',
    });
  };

  return {
    home,
    root: join(home, '.local', 'state', 'wherewerewe'),
    www,
    json: async (argv) => {
      const result = await www(argv);

      return result.stdout
        .trim()
        .split('\n')
        .filter((line) => line !== '')
        .map((line): unknown => JSON.parse(line));
    },
  };
}
