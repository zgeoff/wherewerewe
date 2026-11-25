import { accessSync, constants, realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { readProbeEnv } from '../checks/read-probe-env.ts';
import { findSafeProgram } from './find-safe-program.ts';
import { formatDisplayPath } from './format-display-path.ts';

// The known limits of the checks that apply on this machine, one line each, for `www install` to
// print before it adds an allow rule: the probes run `git` and `gh` on the PATH it holds, and an
// allowed `www` runs them with no prompt. It runs only `git --version`, found as a probe finds it.
export function readCheckLimits(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  home: string,
): string[] {
  const git = readGitVersion(env, cwd);
  const lines: string[] = [];

  if (git !== null) {
    lines.push(
      'a repo that adds a filter to its own config while a check runs can still run it once.',
    );

    if (git.major < 2 || (git.major === 2 && git.minor < 45)) {
      lines.push(
        `git ${git.text} is older than 2.45, so a check leans on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch.`,
      );
    }

    if (git.major < 2 || (git.major === 2 && git.minor < 36)) {
      lines.push(
        `git ${git.text} is older than 2.36, so it reads core.fsmonitor=false as the name of a helper program.`,
      );
    }
  }

  for (const entry of readPathEntries(env)) {
    if (readIsUnder(entry, cwd)) {
      lines.push(
        `${formatDisplayPath(entry, home)} is inside the folder you ran install in, so checks skip it and find no git or gh there.`,
      );
    } else if (readIsWritable(entry)) {
      lines.push(
        `${formatDisplayPath(entry, home)} is on PATH and you can write to it, so a git or gh an agent plants there runs from a check.`,
      );
    }
  }

  return lines;
}

interface GitVersion {
  readonly text: string;
  readonly major: number;
  readonly minor: number;
}

function readGitVersion(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): GitVersion | null {
  const git = findSafeProgram('git', env, cwd);

  if (git === null) {
    return null;
  }

  const result = Bun.spawnSync([git, '--version'], {
    env: readProbeEnv(env, env['PATH'] ?? '', cwd),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'ignore',
  });

  const match = /git version (?<text>(?<major>\d+)\.(?<minor>\d+)[^\s]*)/u.exec(
    result.stdout.toString(),
  );

  if (match?.groups === undefined) {
    return null;
  }

  return {
    text: match.groups['text'] ?? '',
    major: Number(match.groups['major']),
    minor: Number(match.groups['minor']),
  };
}

function readPathEntries(env: Readonly<Record<string, string | undefined>>): string[] {
  return (env['PATH'] ?? '').split(':').filter((entry) => isAbsolute(entry));
}

function readIsUnder(entry: string, cwd: string): boolean {
  const folder = readRealPath(cwd);
  const fromFolder = relative(folder, readRealPath(entry));

  return (
    fromFolder === '' ||
    (fromFolder !== '..' && !fromFolder.startsWith('../') && !isAbsolute(fromFolder))
  );
}

function readRealPath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function readIsWritable(entry: string): boolean {
  try {
    accessSync(entry, constants.W_OK);

    return true;
  } catch {
    return false;
  }
}
