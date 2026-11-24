import { match } from 'ts-pattern';
import { parseCLIArgs } from '../args/parse-cli-args.ts';
import { isSinceText } from '../reads/parse-since.ts';
import type { Placeholder, PlaceholderShape, Refusal, RunLine, RunWord } from '../types.ts';
import { pickArgsRefusals } from '../writes/pick-args-refusals.ts';
import { buildGrantRefusal } from './build-grant-refusal.ts';
import { buildRefusal } from './build-refusal.ts';
import { collectUsageVariants } from './collect-usage-variants.ts';
import type { RefusalScope } from './format-refusal.ts';
import { toPrintedWords } from './to-printed-words.ts';

// The scope a Run line prints in, and the folder its relative paths resolve in.
export interface RunScope extends RefusalScope {
  readonly cwd: string;
}

export interface SettledRefusal {
  readonly refusal: Refusal;

  // the scope to print it in: without the typed --session when its value starts with a dash
  readonly scope: RunScope;
}

// Fills each www Run line with samples and checks it as the parser and the store-free checks would,
// up to 3 steps, then `www help`. A --session value that starts with a dash leaves every Run line;
// a mistyped name stays, so a line never reaches the bound session.
export function settleRefusal(refusal: Refusal, scope: RunScope): SettledRefusal {
  const printScope =
    scope.sessionFlag?.startsWith('-') === true ? { ...scope, sessionFlag: null } : scope;

  const undashed = {
    ...refusal,
    runs: refusal.runs.map((run) => ('www' in run ? { www: dropDashSession(run.www) } : run)),
  };

  return { refusal: settle(undashed, printScope, 0), scope: printScope };
}

// The words without a `--session <value>` or `--session=<value>` before `--` whose value starts
// with a dash.
function dropDashSession(www: readonly RunWord[]): RunWord[] {
  const endOfFlags = www.indexOf('--');
  const flagEnd = endOfFlags === -1 ? www.length : endOfFlags;

  const dropped = new Set(
    www.slice(0, flagEnd).flatMap((word, at): number[] => {
      const next = www[at + 1];

      if (word === '--session' && typeof next === 'string' && next.startsWith('-')) {
        return [at, at + 1];
      }

      return typeof word === 'string' && word.startsWith('--session=-') ? [at] : [];
    }),
  );

  return www.filter((_word, at) => !dropped.has(at));
}

const maxDepth = 3;

function settle(refusal: Refusal, scope: RunScope, depth: number): Refusal {
  const problem = refusal.runs.reduce<Refusal | null>(
    (found, run) => found ?? findLineProblem(run, scope),
    null,
  );

  if (problem === null) {
    return refusal;
  }

  return depth + 1 >= maxDepth
    ? { ...problem, runs: [{ www: ['help'] }] }
    : settle(problem, scope, depth + 1);
}

function findLineProblem(run: RunLine, scope: RunScope): Refusal | null {
  if ('www' in run) {
    return findRunProblem(toPrintedWords(run.www, scope.sessionFlag), scope.cwd);
  }

  return 'usage' in run ? findUsageProblem(run.usage, scope) : null;
}

// The refusal the filled line would get, written back with its placeholders, or null.
function findRunProblem(words: readonly RunWord[], cwd: string): Refusal | null {
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

  const reasons = pickArgsRefusals(parsed.args, cwd);
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

// Each placeholder becomes a sample that no value of the line holds and that passes its slot's
// check: a circled character for text, or a value of its shape. So a sample in the refusal the
// filled line gets stands for its placeholder, and a value the agent typed stays a value.
function fillPlaceholders(words: readonly RunWord[]): Filled {
  const values = words.filter((word) => typeof word === 'string').join(' ');

  const samples = new Map<string, Placeholder>();

  const isFree = (sample: string) => !values.includes(sample) && !samples.has(sample);

  const argv = words.map((word) => {
    if (typeof word === 'string') {
      return word;
    }

    const sample = pickSample(word.shape, isFree);

    samples.set(sample, word);

    return sample;
  });

  return { argv, samples };
}

function pickSample(
  shape: PlaceholderShape | undefined,
  isFree: (sample: string) => boolean,
): string {
  for (let at = 0; at < 0x1_00; at += 1) {
    const sample = toSample(shape, at);

    if (sample !== null && isFree(sample)) {
      return sample;
    }
  }

  // a who whose two values the line already holds takes a text sample, which the check refuses
  return shape === undefined ? String.fromCodePoint(0x24_60) : pickSample(undefined, isFree);
}

function toSample(shape: PlaceholderShape | undefined, at: number): string | null {
  return match(shape)
    .with(undefined, () => String.fromCodePoint(0x24_60 + at))
    .with('id', () => `zz-${String(at)}`)
    .with('path', () => `/zz-${String(at)}`)
    .with('branch', () => `/zz-${String(at)}@zz`)
    .with('pr', () => `zz/zz-${String(at)}#1`)
    .with('pid', () => String(90_000 + at))
    .with('who', () => ['agent', 'owner'][at] ?? null)
    .exhaustive();
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

// A usage line is checked as the parser reads it: its required words alone, then with each optional
// group, or each choice of a group that holds `|`, added. The store-free checks stay out, because
// `grant`'s required words alone hold no bullet. The printed line stays unfilled.
function findUsageProblem(line: string, scope: RunScope): Refusal | null {
  for (const words of collectUsageVariants(line)) {
    const filled = fillPlaceholders(toPrintedWords(words, scope.sessionFlag));
    const parsed = parseCLIArgs(filled.argv);

    if (parsed.kind === 'refused') {
      return restorePlaceholders(buildRefusal(parsed.reason), filled.samples);
    }
  }

  return null;
}
