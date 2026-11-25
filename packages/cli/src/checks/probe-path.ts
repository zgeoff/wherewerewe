import { stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { match } from 'ts-pattern';
import { checkLimits } from './check-limits.ts';
import { parseFilterDrivers } from './parse-filter-drivers.ts';
import type { CheckProbe, RunProbeCommand, StatPath } from './types.ts';

interface PathTarget {
  readonly path: string;
}

// A stat, then git status for the path alone, which keeps a subfolder clean of a change elsewhere.
// No fsmonitor helper, submodule or repo-level filter driver runs, and drivers that cannot be read
// or that change while git runs read unchecked. The stat and each git call share one timeout.
export async function probePath(
  target: PathTarget,
  run: RunProbeCommand,
  statPath: StatPath = stat,
): Promise<CheckProbe> {
  const startMs = performance.now();

  const kind = await readPathKind(target.path, statPath);

  const getLeftMs = (): number => checkLimits.probeTimeoutMs.path - (performance.now() - startMs);

  if (kind === 'missing') {
    return result('missing');
  }

  if (kind === 'timeout' || getLeftMs() <= 0) {
    return unchecked('timeout');
  }

  const folder = kind === 'folder' ? target.path : dirname(target.path);
  const pathspec = kind === 'folder' ? '.' : `./${basename(target.path)}`;

  const listed = await run(buildDriversArgv(folder), getLeftMs());

  const drivers = parseFilterDrivers(listed);

  if (drivers.kind === 'git missing') {
    return result('exists');
  }

  if (drivers.kind === 'unreadable') {
    return unchecked('repo config');
  }

  const command = await run(buildStatusArgv(folder, pathspec, drivers.names), getLeftMs());

  if (command.kind === 'timeout') {
    return unchecked('timeout');
  }

  const listedAfter = await run(buildDriversArgv(folder), getLeftMs());

  const after = parseFilterDrivers(listedAfter);

  if (after.kind !== 'drivers' || after.names.join('\n') !== drivers.names.join('\n')) {
    return unchecked('repo config');
  }

  return match(command)
    .with({ kind: 'missing' }, () => result('exists'))
    .with({ kind: 'exit' }, (exit) => {
      if (exit.code !== 0) {
        return result('exists');
      }

      const state = exit.stdout.trim() === '' ? 'clean' : 'dirty';

      return result(state);
    })
    .exhaustive();
}

// The stat runs off the event loop and races the probe's timeout, so a stalled filesystem cannot
// hold the read past its deadline.
async function readPathKind(
  path: string,
  statPath: StatPath,
): Promise<'folder' | 'file' | 'missing' | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;

  const stalled = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(resolve, checkLimits.probeTimeoutMs.path, 'timeout');
  });

  const kind = await Promise.race([readKind(path, statPath), stalled]);

  clearTimeout(timer);

  return kind;
}

async function readKind(path: string, statPath: StatPath): Promise<'folder' | 'file' | 'missing'> {
  try {
    const info = await statPath(path);

    return info.isDirectory() ? 'folder' : 'file';
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';

    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'file';
  }
}

function result(value: string): CheckProbe {
  return { result: { kind: 'result', result: value }, failing: [] };
}

function unchecked(reason: 'timeout' | 'repo config'): CheckProbe {
  return { result: { kind: 'unchecked', reason }, failing: [] };
}

// Lists each filter driver key with the config it comes from. It reads config and runs nothing.
function buildDriversArgv(folder: string): [string, ...string[]] {
  return [
    'git',
    '--no-optional-locks',
    '-C',
    folder,
    'config',
    '--show-scope',
    '--name-only',
    '--get-regexp',
    String.raw`^filter\..*\.(clean|smudge|process)$`,
  ];
}

// Each named driver gets an empty clean, smudge and process, so git runs none of them.
function buildStatusArgv(
  folder: string,
  pathspec: string,
  drivers: readonly string[],
): [string, ...string[]] {
  return [
    'git',
    '--no-optional-locks',
    '--literal-pathspecs',
    '-c',
    'core.fsmonitor=false',
    ...drivers.flatMap((name) =>
      ['clean', 'smudge', 'process'].flatMap((key) => ['-c', `filter.${name}.${key}=`]),
    ),
    '-C',
    folder,
    'status',
    '--porcelain',
    '--ignore-submodules=all',
    '--',
    pathspec,
  ];
}
