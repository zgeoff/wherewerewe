import { match } from 'ts-pattern';
import { redactCredential } from '../rules/redact-credential.ts';
import type { Refusal, RefusalReason } from '../types.ts';
import { formatList } from './format-list.ts';

type OwnerReason = Extract<
  RefusalReason,
  { kind: 'owner-only' | 'owner-notes-full' | 'owner-note-unknown' }
>;

export function buildOwnerRefusal(reason: OwnerReason): Refusal {
  return match(reason)
    .with({ kind: 'owner-only' }, () =>
      refuse(
        'www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait or an approval.',
        ['rule', '<id>', '<what the owner said, as a rule>'],
      ),
    )
    .with({ kind: 'owner-notes-full' }, (found) =>
      refuse('www: refused: 2 owner notes already show. Clear one that is done.', [
        '--session',
        found.name,
        'ack',
        found.oldestID,
      ]),
    )
    .with({ kind: 'owner-note-unknown' }, (found) =>
      refuse(
        `www: refused: no owner note ${redactCredential(found.id)} shows. Owner notes: ${formatList(found.shownIDs)}.`,
        ['--session', found.name],
      ),
    )
    .exhaustive();
}

function refuse(line: string, argv: readonly string[]): Refusal {
  return { exitCode: 3, lines: [line], runs: [{ www: argv }] };
}
