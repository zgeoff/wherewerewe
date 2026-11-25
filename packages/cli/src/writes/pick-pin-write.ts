import { formatTimestamp } from '../format-timestamp.ts';
import { buildRefusal } from '../refusals/build-refusal.ts';
import { textLimits } from '../rules/text-limits.ts';
import type { ParsedArgs, RefusalReason } from '../types.ts';
import { formatBriefLine } from './format-brief-line.ts';
import { pickTextRefusal } from './pick-text-refusal.ts';
import type { WriteInput, WriteResult } from './types.ts';

// Sets the session's one pin, or clears it with --clear. The pin lives in its own `pin` file, so
// an older www that knows no pin still reads the store.
export function pickPinWrite(input: WriteInput): WriteResult {
  const args = input.args;
  const pin = args.values.clear === true ? '' : (args.positionals[0] ?? '');
  const reason = pickPinArgsRefusal(args);

  if (reason !== null) {
    return { kind: 'refused', refusal: buildRefusal(reason) };
  }

  return {
    kind: 'write',
    change: {
      session: { ...input.store.session, lastWrite: formatTimestamp(input.nowMs) },
      pin,
      journal: [],
    },
    reply: (figure) => `${pin === '' ? 'pin cleared' : 'pin set'}. ${formatBriefLine(figure)}`,
  };
}

// The check that reads the command line and no store: the pin's text. --clear has none.
export function pickPinArgsRefusal(args: ParsedArgs): RefusalReason | null {
  return args.values.clear === true
    ? null
    : pickTextRefusal(
        args,
        [
          {
            target: { label: 'pin', place: { positional: 0 } },
            text: args.positionals[0] ?? '',
            limit: textLimits.pin,
          },
        ],
        false,
      );
}
