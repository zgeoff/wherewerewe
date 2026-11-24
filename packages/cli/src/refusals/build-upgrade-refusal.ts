import { match } from 'ts-pattern';
import { countGrantLines } from '../brief/count-grant-lines.ts';
import { countGrantWords } from '../rules/count-grant-words.ts';
import { grantLimits } from '../rules/grant-limits.ts';
import { redactCredential } from '../rules/redact-credential.ts';
import type { ApprovalLine, ParsedArgs, Refusal, RefusalReason, UpgradeProblem } from '../types.ts';
import { toGrantWords } from '../writes/to-grant-words.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import type { RunSpec } from './build-run-spec.ts';
import { fixGrantText } from './fix-grant-text.ts';
import { formatList } from './format-list.ts';
import { replaceGrantBullets } from './replace-grant-bullets.ts';
import { toRedactedRunWord } from './to-redacted-run-word.ts';

type UpgradeRefusalReason = Extract<RefusalReason, { kind: 'upgrade-refused' }>;

// Prints each problem's lines, then one Run line: the typed command with every flag the problems
// need. Takes the builder of the other refusals, which the text problems of the grant come from.
export function buildUpgradeRefusal(
  found: UpgradeRefusalReason,
  buildReason: (reason: RefusalReason) => Refusal,
): Refusal {
  const rowLines =
    found.rowProblems.length === 0
      ? []
      : [
          `www: refused: import found ${String(found.rowProblems.length)} rows that break the rules, and wrote nothing.`,
          ...found.rowProblems,
        ];

  const problemLines = found.problems.flatMap((problem) =>
    buildProblemLines(problem, found.name, buildReason),
  );

  const lines = [...rowLines, ...problemLines];

  if (found.problems.length === 0) {
    return { exitCode: 3, lines, runs: [{ www: ['import', found.name] }] };
  }

  const spec = addNeededGrantFlags(
    found.problems.reduce(
      (current, problem) => fixProblem(current, problem, buildReason),
      buildRunSpec(found.args),
    ),
    found,
  );

  return { exitCode: 3, lines, runs: [{ www: spec.toArgv() }] };
}

function buildProblemLines(
  problem: UpgradeProblem,
  name: string,
  buildReason: (reason: RefusalReason) => Refusal,
): string[] {
  return match(problem)
    .with({ kind: 'needs-grant' }, (found) => [
      `www: refused: ${name} holds ${String(found.approvals.length)} standing approvals, and format 2 keeps lasting permission in the grant. Record the owner's words in the same command.`,
      ...formatApprovalLines(found.approvals),
    ])
    .with({ kind: 'too-many-once' }, (found) => [
      `www: refused: ${name} holds ${String(found.approvals.length)} one-time approvals, and format 2 holds 1. Drop all but one.`,
      ...formatApprovalLines(found.approvals),
    ])
    .with({ kind: 'grant-id' }, () => [
      `www: refused: format 2 keeps the id grant for the grant, and ${name} has an item grant. Drop it, and write it again under a new id after the upgrade.`,
    ])
    .with({ kind: 'grant-needs-part' }, () => [
      "www: refused: a grant needs at least one --may, --not or --never in the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
    ])
    .with({ kind: 'grant-text' }, (found) => [...buildReason(found.reason).lines])
    .with({ kind: 'drop-unknown' }, (found) => [
      `www: refused: --drop ${redactCredential(found.id)} names no item in ${name}. Items: ${formatList(found.open.map((id) => redactCredential(id)))}.`,
    ])
    .exhaustive();
}

// Each text prints through the credential test, so a stored quote that looks like a secret never
// reaches the refusal.
function formatApprovalLines(approvals: readonly ApprovalLine[]): string[] {
  const ids = approvals.map((approval) => redactCredential(approval.id));
  const width = Math.max(...ids.map((id) => id.length)) + 2;

  return approvals.map(
    (approval, index) =>
      `  ${(ids[index] ?? '').padEnd(width)}"${redactCredential(approval.quote)}" · ${redactCredential(approval.scope)}${approval.age === null ? '' : `  [${approval.age}]`}`,
  );
}

// The grant's flags a problem needs and the command lacks, added once in this order.
function addNeededGrantFlags(spec: RunSpec, found: UpgradeRefusalReason): RunSpec {
  const needsGrant = found.problems.some(
    (problem) => problem.kind === 'needs-grant' || problem.kind === 'grant-needs-part',
  );

  // a standing approval is something the owner allowed, so its grant needs a --may of its own
  const needsMay = found.problems.some((problem) => problem.kind === 'needs-grant');

  const typed = new Set(found.args.flags.map((flag) => flag.name));

  const mayFlags = needsMay ? ['may'] : ['may', 'not', 'never'];

  // a standing approval is one permission, so the line adds one may bullet for each, and they must
  // fit beside the typed bullets, or the filled line would be refused for a grant never typed
  const standingQuotes = found.problems
    .flatMap((problem) => (problem.kind === 'needs-grant' ? problem.approvals : []))
    .map((approval) => approval.quote);

  const fitted =
    needsMay && !typed.has('may') && isGrantFullForMayBullets(found.args, standingQuotes)
      ? replaceGrantBullets(spec, found.args.flags)
      : spec;

  return needsGrant
    ? addGrantFlags(fitted, typed, mayFlags, Math.max(standingQuotes.length, 1))
    : fitted;
}

// Whether one more may bullet for each quote, at least one bullet of one character, breaks a limit
// of the grant's bullets, words or lines.
function isGrantFullForMayBullets(args: ParsedArgs, quotes: readonly string[]): boolean {
  const typedWords = toGrantWords(args);

  const withMay = {
    ...typedWords,
    may: [...typedWords.may, ...(quotes.length === 0 ? ['\u2460'] : quotes)],
  };

  return (
    withMay.may.length + withMay.not.length + withMay.never.length > grantLimits.bullets ||
    countGrantWords(withMay) > grantLimits.words ||
    countGrantLines(withMay) > grantLimits.lines
  );
}

function fixProblem(
  spec: RunSpec,
  problem: UpgradeProblem,
  buildReason: (reason: RefusalReason) => Refusal,
): RunSpec {
  return match(problem)
    .with({ kind: 'needs-grant' }, { kind: 'grant-needs-part' }, () => spec)
    .with({ kind: 'too-many-once' }, (many) => dropAllButNewest(spec, many.approvals))
    .with({ kind: 'grant-id' }, () => spec.addFlag('drop', 'grant'))
    .with({ kind: 'grant-text' }, (text) => fixGrantText(spec, text.reason, buildReason))
    .with({ kind: 'drop-unknown' }, (unknown) => removeDrop(spec, unknown.id))
    .exhaustive();
}

// The newest one-time approval by written is the one that stays.
function dropAllButNewest(spec: RunSpec, approvals: readonly ApprovalLine[]): RunSpec {
  const newest = approvals.reduce((best, approval) =>
    approval.written > best.written ? approval : best,
  );

  return approvals
    .filter((approval) => approval.id !== newest.id)
    .reduce((current, approval) => current.addFlag('drop', approval.id), spec);
}

// The spec holds each typed value through the credential test, so the id is matched the same way.
function removeDrop(spec: RunSpec, id: string): RunSpec {
  return spec.dropFlagValue('drop', toRedactedRunWord(id));
}
