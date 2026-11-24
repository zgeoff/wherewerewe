import type { ParsedArgs, RefusalReason } from '../types.ts';

const wordFlags = ['may', 'not', 'never', 'scope', 'where'] as const;

// A grant needs at least one --may, --where and --reading: any of the grant's flags without those
// three is refused. A command that replaces only the reading, www grant, also takes --reading alone.
export function pickGrantPartsRefusal(
  args: ParsedArgs,
  isReadingAloneAllowed: boolean,
): RefusalReason | null {
  const values = args.values;

  const isPartial =
    wordFlags.some((flag) => values[flag] !== undefined) ||
    (!isReadingAloneAllowed && values.reading !== undefined);

  const hasParts =
    values.may !== undefined && values.where !== undefined && values.reading !== undefined;

  return isPartial && !hasParts ? { kind: 'grant-needs-part', args } : null;
}
