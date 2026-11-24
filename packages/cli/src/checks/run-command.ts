import { spawn } from 'node:child_process';
import type { CommandResult } from './types.ts';

// Stops each command a read started: its whole process group, so a child it started dies too.
export interface KillSet {
  readonly add: (kill: () => void) => () => void;
  readonly killAll: () => void;
}

export function createKillSet(): KillSet {
  const kills = new Set<() => void>();

  return {
    add: (kill) => {
      kills.add(kill);

      return () => {
        kills.delete(kill);
      };
    },
    killAll: () => {
      for (const kill of kills) {
        kill();
      }
    },
  };
}

export interface RunCommandOptions {
  // gh and git are found on its PATH, never on the PATH of this process
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly timeoutMs: number;
  readonly kills: KillSet;
}

// Runs one command with an argv, never through a shell, with stdin closed and no prompt. It lives
// in its own process group. A timeout, or the kill set, kills the group and returns at once,
// without waiting for the pipes of what it killed.
export function runCommand(
  argv: readonly [string, ...string[]],
  options: RunCommandOptions,
): Promise<CommandResult> {
  const [name, ...args] = argv;
  const path = Bun.which(name, { PATH: options.env['PATH'] ?? '' });

  if (path === null) {
    return Promise.resolve({ kind: 'missing' });
  }

  return new Promise<CommandResult>((resolve) => {
    const child = spawn(path, args, {
      env: { ...options.env, GH_PROMPT_DISABLED: '1', GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let isDone = false;

    const finish = (result: CommandResult): void => {
      if (isDone) {
        return;
      }

      isDone = true;

      clearTimeout(timer);
      forget();
      resolve(result);
    };

    const kill = (): void => {
      if (child.pid !== undefined) {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          child.kill('SIGKILL');
        }
      }

      child.stdout.destroy();
      child.stderr.destroy();

      finish({ kind: 'timeout' });
    };

    const timer = setTimeout(kill, options.timeoutMs);
    const forget = options.kills.add(kill);

    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    child.on('error', () => finish({ kind: 'missing' }));

    child.on('close', (code) => {
      finish({
        kind: 'exit',
        code: code ?? 1,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}
