import type { TypedFlag } from '../types.ts';
import type { RunSpec } from './build-run-spec.ts';
import { grantPlaceholders } from './grant-placeholders.ts';

const bulletFlags = ['may', 'not', 'never'] as const;

// Replaces every typed bullet with one placeholder for each group the command typed, at the place
// of the first bullet, so a grant over its bullet cap or its 700 characters gets a Run line that
// fits once the agent fills each group in fewer bullets. Every other flag stays as typed.
export function replaceGrantBullets(spec: RunSpec, typed: readonly TypedFlag[]): RunSpec {
  const groups = bulletFlags.filter((flag) => typed.some((typedFlag) => typedFlag.name === flag));
  const isBullet = (name: string): boolean => bulletFlags.some((flag) => flag === name);
  const firstAt = typed.findIndex((flag) => isBullet(flag.name));
  const after = typed.slice(firstAt).find((flag) => !isBullet(flag.name));
  const cleared = bulletFlags.reduce((current, flag) => current.dropFlag(flag), spec);

  return groups.reduce(
    (current, flag) =>
      after === undefined
        ? current.addFlag(flag, grantPlaceholders[flag])
        : current.addFlagBefore(after.name, flag, grantPlaceholders[flag]),
    cleared,
  );
}
