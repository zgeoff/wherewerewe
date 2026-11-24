import type { ParsedArgs, RefusalReason } from '../types.ts';

const wordFlags = ['may', 'not', 'never', 'scope', 'where'] as const;

// A grant needs at least one --may, --not or --never bullet, --where and --reading: any of the
// grant's flags without those is refused. A command that replaces only the reading, www grant, also
// takes --reading alone.
export function pickGrantPartsRefusal(
  args: ParsedArgs,
  isReadingAloneAllowed: boolean,
): RefusalReason | null {
  const values = args.values;

  const isPartial =
    wordFlags.some((flag) => values[flag] !== undefined) ||
    (!isReadingAloneAllowed && values.reading !== undefined);

  const hasBullet =
    values.may !== undefined || values.not !== undefined || values.never !== undefined;

  const hasParts = hasBullet && values.where !== undefined && values.reading !== undefined;

  return isPartial && !hasParts ? { kind: 'grant-needs-part', args } : null;
}
