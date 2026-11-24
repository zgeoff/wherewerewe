import { parseCLIArgs } from '../args/parse-cli-args.ts';
import { isSinceText } from '../reads/parse-since.ts';
import type { ParsedArgs, Placeholder, Refusal, RefusalReason, RunWord } from '../types.ts';
import { pickGrantPartsRefusal } from '../writes/pick-grant-parts-refusal.ts';
import { pickGrantTextRefusals } from '../writes/pick-grant-text-refusals.ts';
import { buildGrantRefusal } from './build-grant-refusal.ts';
import { buildRefusal } from './build-refusal.ts';
import type { RefusalScope } from './format-refusal.ts';
import { toPrintedWords } from './to-printed-words.ts';

export interface SettledRefusal {
  readonly refusal: Refusal;

  // the scope to print it in: without the typed --session when the parser cannot read it back
  readonly scope: RefusalScope;
}

// Fills each www Run line with samples and checks it as the parser and the store-free checks would.
// A refused line's refusal prints in its place, up to the 3rd step, whose Run line is `www help`. A
// --session that `www help` cannot carry, such as `--help`, leaves every Run line.
export function settleRefusal(refusal: Refusal, scope: RefusalScope): SettledRefusal {
  const isSessionReadable = findRunProblem(toPrintedWords(['help'], scope.sessionFlag)) === null;
  const printScope = isSessionReadable ? scope : { sessionFlag: null };

  return { refusal: settle(refusal, printScope, 0), scope: printScope };
}

// The refusal the filled line would get, written back with its placeholders, or null.
function findRunProblem(words: readonly RunWord[]): Refusal | null {
  const filled = fillPlaceholders(words);
  const parsed = parseCLIArgs(filled.argv);

  if (parsed.kind === 'refused') {
    return restorePlaceholders(buildRefusal(parsed.reason), filled.samples);
  }

  const since = parsed.args.values.since;

  if (
    (parsed.args.command === 'log' || parsed.args.command === 'recap') &&
    since !== undefined &&
    !isSinceText(since)
  ) {
    return restorePlaceholders(
      buildRefusal({ kind: 'bad-since', command: parsed.args.command }),
      filled.samples,
    );
  }

  const reasons = pickArgvReasons(parsed.args);
  const [first, ...rest] = reasons;

  return first === undefined
    ? null
    : restorePlaceholders(
        buildGrantRefusal(parsed.args, [first, ...rest], buildRefusal),
        filled.samples,
      );
}

interface Filled {
  readonly argv: readonly string[];

  // each sample value and the placeholder it stands for
  readonly samples: ReadonlyMap<string, Placeholder>;
}

// Each placeholder becomes a sample: one circled digit or letter that no value of the line holds,
// the shortest text a check passes. So a sample in the refusal the filled line gets stands for its
// placeholder, and a value the agent typed, a circled digit too, stays a value.
function fillPlaceholders(words: readonly RunWord[]): Filled {
  const values = words.filter((word) => typeof word === 'string').join('');

  const samples = new Map<string, Placeholder>();

  let next = 0x24_60;

  const argv = words.map((word) => {
    if (typeof word === 'string') {
      return word;
    }

    while (values.includes(String.fromCodePoint(next))) {
      next += 1;
    }

    const sample = String.fromCodePoint(next);

    next += 1;

    samples.set(sample, word);

    return sample;
  });

  return { argv, samples };
}

// Only Run line words hold samples, each one whole.
function restorePlaceholders(refusal: Refusal, samples: ReadonlyMap<string, Placeholder>): Refusal {
  const restore = (word: RunWord): RunWord =>
    typeof word === 'string' ? (samples.get(word) ?? word) : word;

  return {
    ...refusal,
    runs: refusal.runs.map((run) =>
      'www' in run ? { www: run.www.map((word) => restore(word)) } : run,
    ),
  };
}

// The checks of grant and import that read only the command line.
function pickArgvReasons(args: ParsedArgs): RefusalReason[] {
  if (args.command !== 'grant' && args.command !== 'import') {
    return [];
  }

  const parts = pickGrantPartsRefusal(args, args.command === 'grant');

  return [...(parts === null ? [] : [parts]), ...pickGrantTextRefusals(args)];
}

const maxDepth = 3;

function settle(refusal: Refusal, scope: RefusalScope, depth: number): Refusal {
  const problem = refusal.runs.reduce<Refusal | null>(
    (found, run) =>
      found ?? ('www' in run ? findRunProblem(toPrintedWords(run.www, scope.sessionFlag)) : null),
    null,
  );

  if (problem === null) {
    return refusal;
  }

  return depth + 1 >= maxDepth
    ? { ...problem, runs: [{ www: ['help'] }] }
    : settle(problem, scope, depth + 1);
}
