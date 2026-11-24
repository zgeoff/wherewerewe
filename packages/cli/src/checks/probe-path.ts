import { stat } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { match } from 'ts-pattern';
import { checkLimits } from './check-limits.ts';
import type { CheckProbe, RunProbeCommand, StatPath } from './types.ts';

interface PathTarget {
  readonly path: string;
}

// A stat, then inside a git work tree, git status for the path alone: the pathspec keeps a
// subfolder clean of a change elsewhere, and a literal one keeps a[1].txt from matching a1.txt.
// The stat and the git command share one timeout, and no fsmonitor helper runs.
export async function probePath(
  target: PathTarget,
  run: RunProbeCommand,
  statPath: StatPath = stat,
): Promise<CheckProbe> {
  const startMs = performance.now();

  const kind = await readPathKind(target.path, statPath);

  const leftMs = checkLimits.probeTimeoutMs.path - (performance.now() - startMs);

  if (kind === 'missing') {
    return result('missing');
  }

  if (kind === 'timeout' || leftMs <= 0) {
    return { result: { kind: 'unchecked', reason: 'timeout' }, failing: [] };
  }

  const folder = kind === 'folder' ? target.path : dirname(target.path);
  const pathspec = kind === 'folder' ? '.' : `./${basename(target.path)}`;

  const command = await run(
    [
      'git',
      '--no-optional-locks',
      '--literal-pathspecs',
      '-c',
      'core.fsmonitor=false',
      '-C',
      folder,
      'status',
      '--porcelain',
      '--',
      pathspec,
    ],
    leftMs,
  );

  return match(command)
    .with({ kind: 'missing' }, () => result('exists'))
    .with({ kind: 'timeout' }, (): CheckProbe => ({
      result: { kind: 'unchecked', reason: 'timeout' },
      failing: [],
    }))
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
