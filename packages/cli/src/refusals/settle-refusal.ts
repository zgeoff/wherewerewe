import { parseCLIArgs } from '../args/parse-cli-args.ts';
import type { ParsedArgs, Refusal, RefusalReason } from '../types.ts';
import { pickGrantPartsRefusal } from '../writes/pick-grant-parts-refusal.ts';
import { pickGrantTextRefusals } from '../writes/pick-grant-text-refusals.ts';
import { buildGrantRefusal } from './build-grant-refusal.ts';
import { buildRefusal } from './build-refusal.ts';
import type { RefusalScope } from './format-refusal.ts';
import { toPrintedWords } from './to-printed-words.ts';

// Fills each www Run line with samples and puts it through the parser and the checks that need no
// store. When that would be refused, the refusal it would get prints in its place, and so on, until
// the 3rd step, whose Run line is `www help`.
export function settleRefusal(refusal: Refusal, scope: RefusalScope): Refusal {
  return settle(refusal, scope, 0);
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

// The refusal the filled line would get, written back with its placeholders, or null.
function findRunProblem(words: readonly string[]): Refusal | null {
  const filled = fillPlaceholders(words);
  const parsed = parseCLIArgs(filled.argv);

  if (parsed.kind === 'refused') {
    return restorePlaceholders(buildRefusal(parsed.reason), filled.samples);
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

const placeholderPattern = /^(?<flag>--[a-z][a-z-]*=)?(?<placeholder><[^<>]+>)$/u;

interface Filled {
  readonly argv: readonly string[];

  // each sample value and the placeholder it stands for
  readonly samples: ReadonlyMap<string, string>;
}

function fillPlaceholders(words: readonly string[]): Filled {
  const samples = new Map<string, string>();

  const argv = words.map((word) => {
    const groups = placeholderPattern.exec(word)?.groups;
    const placeholder = groups?.['placeholder'];

    if (placeholder === undefined) {
      return word;
    }

    const sample = String.fromCodePoint(0x24_60 + samples.size);

    samples.set(sample, placeholder);

    return `${groups?.['flag'] ?? ''}${sample}`;
  });

  return { argv, samples };
}

// A sample is one circled digit, the shortest text a check passes, so a length a refusal measures
// is the least the filled line can have. Only Run line words hold samples.
function restorePlaceholders(refusal: Refusal, samples: ReadonlyMap<string, string>): Refusal {
  const restore = (word: string): string => {
    const joined = /^(?<flag>--[a-z][a-z-]*=)?(?<value>.*)$/su.exec(word)?.groups;
    const placeholder = samples.get(joined?.['value'] ?? '');

    return placeholder === undefined ? word : `${joined?.['flag'] ?? ''}${placeholder}`;
  };

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
