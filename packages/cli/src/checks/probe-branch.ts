import { match } from 'ts-pattern';
import { checkLimits } from './check-limits.ts';
import type { CheckProbe, CommandResult, RunProbeCommand } from './types.ts';

interface BranchTarget {
  readonly repoPath: string;
  readonly name: string;
}

// git -C <repo> rev-parse, then rev-list against the upstream. Both are read-only, and the two
// share one timeout.
export async function probeBranch(target: BranchTarget, run: RunProbeCommand): Promise<CheckProbe> {
  const startMs = performance.now();

  if (target.name.startsWith('-')) {
    return result('gone');
  }

  const parse = await run(
    ['git', '-C', target.repoPath, 'rev-parse', '--verify', '--quiet', `refs/heads/${target.name}`],
    checkLimits.probeTimeoutMs.branch,
  );

  const found = readFound(parse);

  if (found !== 'found') {
    return found;
  }

  const remainingMs = Math.max(
    1,
    checkLimits.probeTimeoutMs.branch - (performance.now() - startMs),
  );

  const list = await run(
    [
      'git',
      '-C',
      target.repoPath,
      'rev-list',
      '--left-right',
      '--count',
      `${target.name}...${target.name}@{upstream}`,
    ],
    remainingMs,
  );

  return match(list)
    .with({ kind: 'missing' }, (): CheckProbe => unchecked('git missing'))
    .with({ kind: 'timeout' }, (): CheckProbe => unchecked('timeout'))
    .with({ kind: 'exit' }, (exit) => readCounts(exit))
    .exhaustive();
}

function result(value: string): CheckProbe {
  return { result: { kind: 'result', result: value }, failing: [] };
}

function readFound(parse: CommandResult): 'found' | CheckProbe {
  return match(parse)
    .with({ kind: 'missing' }, (): 'found' | CheckProbe => unchecked('git missing'))
    .with({ kind: 'timeout' }, (): 'found' | CheckProbe => unchecked('timeout'))
    .with({ kind: 'exit' }, (exit): 'found' | CheckProbe =>
      exit.code === 0 ? 'found' : result('gone'),
    )
    .exhaustive();
}

function unchecked(reason: 'git missing' | 'timeout'): CheckProbe {
  return { result: { kind: 'unchecked', reason }, failing: [] };
}

function readCounts(exit: Extract<CommandResult, { kind: 'exit' }>): CheckProbe {
  if (exit.code !== 0) {
    return result('no upstream');
  }

  const counts = /^(?<ahead>[0-9]+)\s+(?<behind>[0-9]+)\s*$/u.exec(exit.stdout)?.groups;
  const ahead = Number(counts?.['ahead']);
  const behind = Number(counts?.['behind']);

  if (counts === undefined || !Number.isSafeInteger(ahead) || !Number.isSafeInteger(behind)) {
    return unchecked('git missing');
  }

  if (ahead > 0 && behind > 0) {
    return result('diverged');
  }

  if (ahead > 0) {
    return result(`ahead ${String(ahead)}`);
  }

  return behind > 0 ? result(`behind ${String(behind)}`) : result('pushed');
}
