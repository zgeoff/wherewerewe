import { barePlaceholders } from '../refusals/format-command-line.ts';
import type { RefusalScope } from '../refusals/format-refusal.ts';
import { formatRefusal, nothingWrittenComment } from '../refusals/format-refusal.ts';
import { pickUpgradeRun } from '../refusals/pick-upgrade-run.ts';
import type { Refusal, RunLine, RunWord } from '../types.ts';
import { buildShellReplayLine } from './build-shell-replay-line.ts';
import { parseRunLine } from './parse-run-line.ts';

export interface RefusalReplay {
  // each printed Run line of each scope, filled as a test fills it, one per line of the script
  readonly script: string;

  // the words each line should hand its program, the program's name first
  readonly expected: string[][];

  // whether each printed Run line ends with the comment of a refused write, and whether it should
  readonly comments: boolean[];
  readonly expectedComments: boolean[];
}

// The Run lines a refusal prints in each scope, as one shell script, and the words a shell should
// pass for each, taken from the refusal's runs and the typed --session, never from the printed
// text: a bare placeholder is filled as the script fills it, and a quoted one passes as its text.
export function buildRefusalReplay(
  refusal: Refusal,
  scopes: readonly RefusalScope[],
): RefusalReplay {
  const printed = scopes.flatMap((scope) =>
    formatRefusal(refusal, scope)
      .split('\n')
      .filter((line) => line.startsWith('Run: ')),
  );

  return {
    script: printed.map((line) => buildShellReplayLine(line.slice('Run: '.length))).join('\n'),
    expected: scopes.flatMap((scope) =>
      refusal.runs.flatMap((run) => buildExpectedWords(run, scope)),
    ),
    comments: printed.map((line) => line.endsWith(nothingWrittenComment)),
    expectedComments: scopes.flatMap((scope) =>
      refusal.runs.map((_run, at) => scope.writes && at === refusal.runs.length - 1),
    ),
  };
}

// The words of each program a Run line starts, in the order a pipe's stand-ins print them.
function buildExpectedWords(run: RunLine, scope: RefusalScope): string[][] {
  if ('upgrade' in run) {
    return buildExpectedWords(scope.upgradeRun ?? pickUpgradeRun('', '', ''), scope);
  }

  if ('shell' in run) {
    return [[...run.shell]];
  }

  if ('pipeline' in run) {
    return run.pipeline.map((words) => [...words]);
  }

  const sessionFlag = scope.sessionFlag;

  if ('usage' in run) {
    const usage = parseRunLine(`Run: www ${buildShellReplayLine(run.usage)}`.trimEnd());

    return [['www', ...(sessionFlag === null ? [] : ['--session', sessionFlag]), ...usage]];
  }

  const endOfFlags = run.www.indexOf('--');
  const flagWords = endOfFlags === -1 ? run.www : run.www.slice(0, endOfFlags);

  const hasSession = flagWords.some(
    (word) => typeof word === 'string' && (word === '--session' || word.startsWith('--session=')),
  );

  return [
    [
      'www',
      ...(sessionFlag === null || hasSession ? [] : ['--session', sessionFlag]),
      ...run.www.map((word) => toExpectedWord(word)),
    ],
  ];
}

function toExpectedWord(word: RunWord): string {
  if (typeof word === 'string') {
    return word;
  }

  return barePlaceholders.has(word.placeholder)
    ? buildShellReplayLine(word.placeholder)
    : word.placeholder;
}
