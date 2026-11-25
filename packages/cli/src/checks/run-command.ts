import { spawn } from 'node:child_process';
import { resolve as resolvePath } from 'node:path';
import { readProbeEnv } from './read-probe-env.ts';
import { readProbePath, readProbeProgram } from './read-probe-path.ts';
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
  // gh and git are found on its PATH, never on the PATH of this process, and get only some of it
  readonly env: Readonly<Record<string, string | undefined>>;

  // the folder the command was typed in, whose PATH entries a probe never uses
  readonly cwd: string;
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
  const trees = [options.cwd, ...collectTargetFolders(args, options.cwd)];
  const probePath = readProbePath(options.env['PATH'] ?? '', options.cwd, trees);
  const path = readProbeProgram(name, probePath, options.cwd, trees);

  if (path === null) {
    return Promise.resolve({ kind: 'missing' });
  }

  return new Promise<CommandResult>((resolve) => {
    // the interrupt handlers go in before the command starts, so a signal that arrives as it starts
    // still kills its group; a signal runs the handler only after this block, once kill exists
    const forgetLive = trackLive(() => {
      kill();
    });

    // Git before 2.45 cannot switch lazy fetch off, so GIT_ALLOW_PROTOCOL leaves it no transport.
    const child = spawn(path, args, {
      env: readProbeEnv(options.env, probePath, options.cwd),
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
    const forgetKill = options.kills.add(kill);

    const forget = (): void => {
      forgetKill();
      forgetLive();
    };

    child.stdout.on('data', (chunk: Buffer) => {
      stdout.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr.push(chunk);
    });

    child.on('error', () => {
      finish({ kind: 'missing' });
    });

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

// The folders a probe's git works in: each value after `-C`, read from the folder the command runs
// in, so the work tree of the repo a probe targets is guarded as the workspace is.
function collectTargetFolders(args: readonly string[], cwd: string): string[] {
  return args.flatMap((arg, at) => {
    const next = args[at + 1];

    return arg === '-C' && next !== undefined ? [resolvePath(cwd, next)] : [];
  });
}

// Every command still running in this process. An interrupt or an exit of the process kills each
// one's group, so no probe outlives the CLI. The handlers exist only while a command runs.
const live = new Set<() => void>();

function trackLive(kill: () => void): () => void {
  if (live.size === 0) {
    process.on('SIGINT', raiseInterrupt);
    process.on('SIGTERM', raiseInterrupt);
    process.on('exit', killLive);
  }

  live.add(kill);

  return () => {
    live.delete(kill);

    if (live.size === 0) {
      process.off('SIGINT', raiseInterrupt);
      process.off('SIGTERM', raiseInterrupt);
      process.off('exit', killLive);
    }
  };
}

function raiseInterrupt(signal: NodeJS.Signals): void {
  killLive();

  process.off('SIGINT', raiseInterrupt);
  process.off('SIGTERM', raiseInterrupt);
  process.off('exit', killLive);
  process.kill(process.pid, signal);
}

function killLive(): void {
  for (const kill of live) {
    kill();
  }
}
