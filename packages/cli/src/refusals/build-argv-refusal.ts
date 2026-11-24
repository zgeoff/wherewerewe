import { match } from 'ts-pattern';
import type { Refusal, RefusalReason, RunWord } from '../types.ts';

type ArgvRefusalReason = Extract<
  RefusalReason,
  {
    kind:
      | 'unknown-command'
      | 'later-command'
      | 'unknown-flag'
      | 'flag-needs-value'
      | 'flag-value-has-dash'
      | 'flag-takes-no-value'
      | 'flag-not-taken'
      | 'wrong-positionals';
  }
>;

// The usage refusals for a command line the parser cannot read, each exit code 2. Each points at
// `www help`, except a value that starts with a dash, whose Run line is the command it fixes.
export function buildArgvRefusal(reason: ArgvRefusalReason): Refusal {
  return match(reason)
    .with({ kind: 'unknown-command' }, (found) => usage(`www: unknown command "${found.command}".`))
    .with({ kind: 'later-command' }, (found) =>
      usage(`www: "${found.command}" comes in a later version of www.`),
    )
    .with({ kind: 'unknown-flag' }, (found) => usage(`www: unknown flag "${found.flag}".`))
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
      usage(`www: ${found.command} takes ${found.usage}.`),
    )
    .exhaustive();
}

function usage(line: string, argv: readonly RunWord[] = ['help']): Refusal {
  return { exitCode: 2, lines: [line], runs: [{ www: argv }] };
}

function buildFlagNotTaken(found: Extract<ArgvRefusalReason, { kind: 'flag-not-taken' }>): Refusal {
  if (found.line === null || found.taken.length === 0) {
    return usage(`www: ${found.command} takes no --${found.flag} flag.`);
  }

  return {
    exitCode: 2,
    lines: [
      `www: ${found.command} takes no --${found.flag} flag. It takes ${joinFlags(found.taken)}.`,
    ],
    runs: [{ usage: found.line }],
  };
}

// `--a`, `--a and --b`, or `--a, --b and --c`.
function joinFlags(flags: readonly string[]): string {
  const named = flags.map((flag) => `--${flag}`);
  const last = named.at(-1);

  return named.length === 1 ? (last ?? '') : `${named.slice(0, -1).join(', ')} and ${last ?? ''}`;
}
