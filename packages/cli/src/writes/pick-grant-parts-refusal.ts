import type { ParsedArgs, RefusalReason } from '../types.ts';

// The grant's three flags go together: --quote or --where without all three is refused. A command
// that replaces only the reading, www grant, also takes --reading alone.
export function pickGrantPartsRefusal(
  args: ParsedArgs,
  isReadingAloneAllowed: boolean,
): RefusalReason | null {
  const isPartial =
    args.values.quote !== undefined ||
    args.values.where !== undefined ||
    (!isReadingAloneAllowed && args.values.reading !== undefined);

  const hasAllThree =
    args.values.quote !== undefined &&
    args.values.where !== undefined &&
    args.values.reading !== undefined;

  return isPartial && !hasAllThree ? { kind: 'grant-needs-part', args } : null;
}
