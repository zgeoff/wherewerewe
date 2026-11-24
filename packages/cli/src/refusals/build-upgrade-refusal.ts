import { match } from 'ts-pattern';
import { redactCredential } from '../rules/redact-credential.ts';
import type { ApprovalLine, Refusal, RefusalReason, UpgradeProblem } from '../types.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import type { RunSpec } from './build-run-spec.ts';
import { formatList } from './format-list.ts';

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
      "www: refused: a grant needs the owner's words, where they were given, and your reading of what they cover and what the owner kept back.",
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

  const typed = new Set(found.args.flags.map((flag) => flag.name));

  return needsGrant ? addGrantFlags(spec, typed) : spec;
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
    .with({ kind: 'grant-text' }, (text) => replaceTextFlag(spec, text.reason, buildReason))
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

// The Run line of the text problem alone holds the value that replaces the flag's text.
function replaceTextFlag(
  spec: RunSpec,
  reason: RefusalReason,
  buildReason: (reason: RefusalReason) => Refusal,
): RunSpec {
  const flag = match(reason)
    .with(
      { kind: 'text-too-long' },
      { kind: 'text-not-one-line' },
      { kind: 'text-empty' },
      { kind: 'credential' },
      (text) => ('flag' in text.target.place ? text.target.place.flag : null),
    )
    .with({ kind: 'grant-words-too-long' }, () => 'quote')
    .with({ kind: 'extra-has-separator' }, (separator) => separator.flag)
    .otherwise(() => null);

  const [run] = buildReason(reason).runs;
  const argv = run !== undefined && 'www' in run ? run.www : [];
  const value = flag === null ? null : readFlagValue(argv, flag);

  return flag === null || value === null ? spec : spec.replaceFlag(flag, value);
}

// The value of --flag in a Run line's words, typed as --flag value or --flag=value.
function readFlagValue(argv: readonly string[], flag: string): string | null {
  const at = argv.findIndex((word) => word === `--${flag}` || word.startsWith(`--${flag}=`));
  const word = argv.at(at);

  if (at === -1 || word === undefined) {
    return null;
  }

  return word.includes('=') ? word.slice(word.indexOf('=') + 1) : (argv.at(at + 1) ?? null);
}

// The spec holds each typed value through the credential test, so the id is matched the same way.
function removeDrop(spec: RunSpec, id: string): RunSpec {
  return spec.dropFlagValue('drop', redactCredential(id));
}
