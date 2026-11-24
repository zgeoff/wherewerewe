import { match } from 'ts-pattern';
import type { CheckFlag, ParsedArgs, Refusal, RefusalReason, RunWord } from '../types.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { toPlaceholder } from './to-placeholder.ts';

type CheckValueReason = Extract<RefusalReason, { kind: 'malformed-check' | 'check-not-one-line' }>;

export function buildCheckValueRefusal(found: CheckValueReason): Refusal {
  return found.kind === 'malformed-check'
    ? buildMalformedCheckRefusal(found.args, found.flag)
    : buildCheckNotOneLineRefusal(found.args, found.flag);
}

function buildMalformedCheckRefusal(args: ParsedArgs, flag: CheckFlag): Refusal {
  const spec = buildRunSpec(args);

  return match(flag)
    .with('pr', () =>
      refuse(
        'www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.',
        spec.replaceFlag('pr', toPlaceholder('<owner>/<repo>#<number>', 'pr')).toArgv(),
      ),
    )
    .with('branch', () =>
      refuse(
        'www: refused: --branch takes <absolute repo path>@<branch>, such as /home/sam/src/bosun-api@tz-fix.',
        spec
          .replaceFlag('branch', toPlaceholder('<absolute repo path>@<branch>', 'branch'))
          .toArgv(),
      ),
    )
    .with('pid', () =>
      refuse(
        'www: refused: --pid takes a process id, such as 48211.',
        spec.replaceFlag('pid', toPlaceholder('<process id>', 'pid')).toArgv(),
      ),
    )
    .with('path', () =>
      refuse(
        'www: refused: --path takes an absolute path.',
        spec.replaceFlag('path', toPlaceholder('<absolute path>', 'path')).toArgv(),
      ),
    )
    .exhaustive();
}

function refuse(line: string, argv: readonly RunWord[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}

// A check value with a tab or a line break: its placeholder takes the flag's shape, so the Run
// line's check fills it with a value the flag accepts.
function buildCheckNotOneLineRefusal(args: ParsedArgs, flag: CheckFlag): Refusal {
  return refuse(
    'www: refused: the text must be one line, with no tab or newline.',
    buildRunSpec(args).replaceFlag(flag, toPlaceholder('<one line>', flag)).toArgv(),
  );
}
