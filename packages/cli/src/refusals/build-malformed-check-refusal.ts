import { match } from 'ts-pattern';
import type { CheckFlag, ParsedArgs, Refusal, RunWord } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { toPlaceholder } from './to-placeholder.ts';

export function buildMalformedCheckRefusal(args: ParsedArgs, flag: CheckFlag): Refusal {
  const spec = buildRunSpec(args);

  return match(flag)
    .with('pr', () =>
      refuse(
        'www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.',
        spec.replaceFlag('pr', toPlaceholder('<owner>/<repo>#<number>')).toArgv(),
      ),
    )
    .with('branch', () =>
      refuse(
        'www: refused: --branch takes <absolute repo path>@<branch>, such as /home/sam/src/bosun-api@tz-fix.',
        spec.replaceFlag('branch', toPlaceholder('<absolute repo path>@<branch>')).toArgv(),
      ),
    )
    .with('pid', () =>
      refuse(
        'www: refused: --pid takes a process id, such as 48211.',
        spec.replaceFlag('pid', toPlaceholder('<process id>')).toArgv(),
      ),
    )
    .with('path', () =>
      refuse(
        'www: refused: --path takes an absolute path.',
        spec.replaceFlag('path', toPlaceholder('<absolute path>')).toArgv(),
      ),
    )
    .exhaustive();
}

function refuse(line: string, argv: readonly RunWord[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}
