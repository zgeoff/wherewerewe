import { statSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { match } from 'ts-pattern';
import { checkLimits } from './check-limits.ts';
import type { CheckProbe, RunProbeCommand } from './types.ts';

interface PathTarget {
  readonly path: string;
}

// A stat, then inside a git work tree, git status for the path alone. The pathspec keeps a
// subfolder from reading dirty for a change elsewhere in the tree, and lets a file path work.
export async function probePath(target: PathTarget, run: RunProbeCommand): Promise<CheckProbe> {
  const kind = readPathKind(target.path);

  if (kind === 'missing') {
    return result('missing');
  }

  const folder = kind === 'folder' ? target.path : dirname(target.path);
  const pathspec = kind === 'folder' ? '.' : `./${basename(target.path)}`;

  const command = await run(
    ['git', '--no-optional-locks', '-C', folder, 'status', '--porcelain', '--', pathspec],
    checkLimits.probeTimeoutMs.path,
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

function readPathKind(path: string): 'folder' | 'file' | 'missing' {
  try {
    return statSync(path).isDirectory() ? 'folder' : 'file';
  } catch (error) {
    const code = error instanceof Error && 'code' in error ? String(error.code) : '';

    return code === 'ENOENT' || code === 'ENOTDIR' ? 'missing' : 'file';
  }
}

function result(value: string): CheckProbe {
  return { result: { kind: 'result', result: value }, failing: [] };
}
