import { match } from 'ts-pattern';
import type { Refusal, RefusalReason, RunWord } from '../types.ts';
import type { RunSpec } from './build-run-spec.ts';
import { replaceGrantBullets } from './replace-grant-bullets.ts';

interface FlagPlace {
  readonly flag: string;

  // the value's place among the flag's values, for a flag that repeats; null for one that does not
  readonly occurrence: number | null;
}

// The Run line of the text problem alone holds the value that replaces the flag's text. Too many
// bullets, lines or words replace every bullet, as that problem's own Run line does.
export function fixGrantText(
  spec: RunSpec,
  reason: RefusalReason,
  buildReason: (reason: RefusalReason) => Refusal,
): RunSpec {
  const place: FlagPlace | null = match(reason)
    .with(
      { kind: 'text-too-long' },
      { kind: 'text-not-one-line' },
      { kind: 'text-empty' },
      { kind: 'credential' },
      { kind: 'text-has-mark' },
      (text): FlagPlace | null =>
        'flag' in text.target.place
          ? {
              flag: text.target.place.flag,
              occurrence: 'occurrence' in text.target.place ? text.target.place.occurrence : null,
            }
          : null,
    )
    .with({ kind: 'extra-has-separator' }, (separator) => ({
      flag: separator.flag,
      occurrence: null,
    }))
    .otherwise(() => null);

  if (
    reason.kind === 'grant-words-too-long' ||
    reason.kind === 'grant-too-many-bullets' ||
    reason.kind === 'grant-too-many-lines'
  ) {
    return replaceGrantBullets(spec, reason.args.flags);
  }

  const [run] = buildReason(reason).runs;
  const argv = run !== undefined && 'www' in run ? run.www : [];
  const value = place === null ? null : readFlagValue(argv, place.flag, place.occurrence ?? 0);

  if (place === null || value === null) {
    return spec;
  }

  return place.occurrence === null
    ? spec.replaceFlag(place.flag, value)
    : spec.replaceFlagAt(place.flag, place.occurrence, value);
}

// The value of the given occurrence of --flag in a Run line's words, typed as --flag value or
// --flag=value.
function readFlagValue(argv: readonly RunWord[], flag: string, occurrence: number): RunWord | null {
  const places = argv.flatMap((word, at) =>
    word === `--${flag}` || (typeof word === 'string' && word.startsWith(`--${flag}=`)) ? [at] : [],
  );

  const at = places.at(occurrence);
  const word = at === undefined ? undefined : argv.at(at);

  if (at === undefined || word === undefined) {
    return null;
  }

  return typeof word === 'string' && word.includes('=')
    ? word.slice(word.indexOf('=') + 1)
    : (argv.at(at + 1) ?? null);
}
