import { match } from 'ts-pattern';
import { listKinds } from '../rules/list-kinds.ts';
import type { Refusal, RefusalReason, RunWord } from '../types.ts';

type ArgvRefusalReason = Extract<
  RefusalReason,
  {
    kind:
      | 'unknown-command'
      | 'flag-needs-value'
      | 'flag-value-has-dash'
      | 'flag-takes-no-value'
      | 'flag-not-taken'
      | 'wrong-positionals'
      | 'goal-paste-with-text'
      | 'bad-list-kind';
  }
>;

// The usage refusals for a command line the parser cannot read, each exit code 2. Each points at
// `www help`, except a value that starts with a dash, whose Run line is the command it fixes, and a
// flag the command does not take, whose Run line is the command's help line.
export function buildArgvRefusal(reason: ArgvRefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'unknown-command' }, (found) => usage(`www: unknown command "${found.command}".`))
    .with({ kind: 'flag-needs-value' }, (found) => usage(`www: --${found.flag} needs a value.`))
    .with({ kind: 'flag-value-has-dash' }, (found) =>
      usage(
        `www: the value of --${found.flag} starts with a dash, so it reads as a flag. Join the two with =, as in --${found.flag}="<value>".`,
        found.argv,
      ),
    )
    .with({ kind: 'flag-takes-no-value' }, (found) => usage(`www: --${found.flag} takes no value.`))
    .with({ kind: 'flag-not-taken' }, (found) => buildFlagNotTaken(found))
    .with({ kind: 'wrong-positionals' }, (found) =>
      usageLine(`www: ${found.command} takes ${found.usage}.`, found.line),
    )
    .with({ kind: 'goal-paste-with-text' }, () =>
      usageLine('www: goal --paste takes no goal text.', 'goal --paste'),
    )
    .with({ kind: 'bad-list-kind' }, () =>
      usage(`www: list takes ${formatKinds()}.`, ['list', 'tasks']),
    )
    .exhaustive();
}

function usage(line: string, argv: readonly RunWord[] = ['help']): Refusal {
  return { exitCode: 2, lines: [line], runs: [{ www: argv }] };
}

// Names the refused flag and each flag the command takes, and prints the command's help line as its
// Run line, so the agent sees the right flag without reading the whole help.
function buildFlagNotTaken(found: Extract<ArgvRefusalReason, { kind: 'flag-not-taken' }>): Refusal {
  const named = found.command === 'brief' ? 'the brief' : found.command;
  const takes = found.taken.length === 0 ? 'only --session' : joinFlags(found.taken);

  return {
    exitCode: 2,
    lines: [`www: ${named} takes no ${found.flag} flag. It takes ${takes}.`],
    runs: [{ usage: found.line }],
  };
}

// `--a`, `--a and --b`, or `--a, --b and --c`.
function joinFlags(flags: readonly string[]): string {
  const named = flags.map((flag) => `--${flag}`);
  const last = named.at(-1);

  return named.length === 1 ? (last ?? '') : `${named.slice(0, -1).join(', ')} and ${last ?? ''}`;
}

function usageLine(line: string, helpLine: string): Refusal {
  return { exitCode: 2, lines: [line], runs: [{ usage: helpLine }] };
}

// `a, b or c`.
function formatKinds(): string {
  return `${listKinds.slice(0, -1).join(', ')} or ${listKinds.at(-1) ?? ''}`;
}
