import { accessSync, constants, realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import { readProbeEnv } from '../checks/read-probe-env.ts';
import { readProbePath } from '../checks/read-probe-path.ts';
import { formatDisplayPath } from './format-display-path.ts';
import { readSafeProgram } from './read-safe-program.ts';

const configFolderNames = ['HOME', 'XDG_CONFIG_HOME', 'GH_CONFIG_DIR'] as const;

// The known limits of the checks that apply on this machine, one line each, for `www install` to
// print before it adds an allow rule: the probes run `git` and `gh` on the PATH it holds, and an
// allowed `www` runs them with no prompt. It runs only `git --version`, found as a probe finds it.
export function readCheckLimits(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
  home: string,
): string[] {
  const lines = collectGitLimits(readGitVersion(env, cwd));

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

  for (const name of configFolderNames) {
    const folder = env[name];

    if (folder !== undefined && isAbsolute(folder) && readIsWritable(folder)) {
      lines.push(
        `${name} names ${formatDisplayPath(folder, home)}, which you can write to, so a git or gh config an agent writes there is read by a check.`,
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

// `null` when no git is found; `version` is `null` when git ran and printed no version to read.
interface GitFound {
  readonly version: GitVersion | null;
}

function collectGitLimits(git: GitFound | null): string[] {
  if (git === null) {
    return [];
  }

  const lines = [
    'a repo that adds a filter to its own config while a check runs can still run it once.',
  ];

  if (git.version === null) {
    lines.push(
      'the version of git could not be read, so a git older than 2.45 may lean on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch, and one older than 2.36 reads core.fsmonitor=false as the name of a helper program.',
    );

    return lines;
  }

  const version = git.version;

  if (version.major < 2 || (version.major === 2 && version.minor < 45)) {
    lines.push(
      `git ${version.text} is older than 2.45, so a check leans on GIT_ALLOW_PROTOCOL alone to stop a lazy fetch.`,
    );
  }

  if (version.major < 2 || (version.major === 2 && version.minor < 36)) {
    lines.push(
      `git ${version.text} is older than 2.36, so it reads core.fsmonitor=false as the name of a helper program.`,
    );
  }

  return lines;
}

function readGitVersion(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): GitFound | null {
  const git = readSafeProgram('git', env, cwd);

  if (git === null) {
    return null;
  }

  const output = readVersionOutput(git, env, cwd);
  const match = /git version (?<text>(?<major>\d+)\.(?<minor>\d+)[^\s]*)/u.exec(output);

  if (match?.groups === undefined) {
    return { version: null };
  }

  return {
    version: {
      text: match.groups['text'] ?? '',
      major: Number(match.groups['major']),
      minor: Number(match.groups['minor']),
    },
  };
}

// A git that is found but fails to start, such as a script whose interpreter is gone, prints no
// version.
function readVersionOutput(
  git: string,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string {
  try {
    const result = Bun.spawnSync([git, '--version'], {
      env: readProbeEnv(env, readProbePath(env['PATH'] ?? '', cwd), cwd),
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
    });

    return result.stdout.toString();
  } catch {
    return '';
  }
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
