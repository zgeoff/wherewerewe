import { resolve } from 'node:path';
import { match } from 'ts-pattern';
import type { CheckFlag, CheckRef, TypedFlag } from '../types.ts';

export type CheckFlagsResult =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'check';
      readonly ref: CheckRef;
      readonly flag: CheckFlag;
      readonly value: string;
    }
  | {
      readonly kind: 'too-many';
      readonly first: { readonly flag: CheckFlag; readonly value: string };
    }
  | { readonly kind: 'malformed'; readonly flag: CheckFlag }
  | { readonly kind: 'not-one-line'; readonly flag: CheckFlag }
  | { readonly kind: 'relative'; readonly flag: 'path' | 'branch'; readonly absolute: string };

export function parseCheckFlags(flags: readonly TypedFlag[], cwd: string): CheckFlagsResult {
  const checks = flags.flatMap((flag) =>
    isCheckFlag(flag.name) && flag.value !== null ? [{ flag: flag.name, value: flag.value }] : [],
  );

  const [first] = checks;

  if (first === undefined) {
    return { kind: 'none' };
  }

  if (checks.length > 1) {
    return { kind: 'too-many', first };
  }

  return parseCheck(first.flag, first.value, cwd);
}

const checkFlagNames: ReadonlySet<string> = new Set(['pr', 'branch', 'path', 'pid']);

function isCheckFlag(name: string): name is CheckFlag {
  return checkFlagNames.has(name);
}

function parseCheck(flag: CheckFlag, value: string, cwd: string): CheckFlagsResult {
  return match(flag)
    .with('pr', (): CheckFlagsResult =>
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+#[1-9][0-9]*$/u.test(value)
        ? { kind: 'check', ref: `pr:${value}`, flag, value }
        : { kind: 'malformed', flag },
    )
    .with('pid', (): CheckFlagsResult =>
      /^[1-9][0-9]*$/u.test(value)
        ? { kind: 'check', ref: `pid:${value}`, flag, value }
        : { kind: 'malformed', flag },
    )
    .with('path', () => parsePath(value, cwd))
    .with('branch', () => parseBranch(value, cwd))
    .exhaustive();
}

// A cell of the store never holds a tab or a newline, so a path that does is refused.
function parsePath(value: string, cwd: string): CheckFlagsResult {
  if (/[\t\n\r]/u.test(value)) {
    return { kind: 'not-one-line', flag: 'path' };
  }

  if (value === '') {
    return { kind: 'malformed', flag: 'path' };
  }

  return value.startsWith('/')
    ? { kind: 'check', ref: `path:${value}`, flag: 'path', value }
    : { kind: 'relative', flag: 'path', absolute: resolve(cwd, value) };
}

function parseBranch(value: string, cwd: string): CheckFlagsResult {
  if (/[\t\n\r]/u.test(value)) {
    return { kind: 'not-one-line', flag: 'branch' };
  }

  const split = value.lastIndexOf('@');
  const folder = value.slice(0, split);
  const branch = value.slice(split + 1);

  if (split < 1 || branch === '' || /\s/u.test(branch)) {
    return { kind: 'malformed', flag: 'branch' };
  }

  return folder.startsWith('/')
    ? { kind: 'check', ref: `branch:${value}`, flag: 'branch', value }
    : { kind: 'relative', flag: 'branch', absolute: `${resolve(cwd, folder)}@${branch}` };
}
