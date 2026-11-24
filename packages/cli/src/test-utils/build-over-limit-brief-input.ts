import type { BriefInput } from '../brief/types.ts';
import { buildMockBriefInput } from './build-mock-brief-input.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildMockItem } from './build-mock-item.ts';
import { buildMockNote } from './build-mock-note.ts';
import { buildMockSession } from './build-mock-session.ts';

export interface OverLimitOptions {
  readonly taskCount: number;

  // the item in focus, which carries a note, or null
  readonly focus: string | null;

  // the characters of every claim; 450 when left out
  readonly claimLength?: number;
}

// A store over its limits: every claim as long as the options say, 4 waits, 1 approval, 5 rules, 4
// where items and a pull request row.
export function buildOverLimitBriefInput(options: OverLimitOptions): BriefInput {
  const claim = 'c'.repeat(options.claimLength ?? 450);
  const note = buildMockNote({ id: options.focus ?? '', note: 'Keep this note whole' });

  return buildMockBriefInput({
    session: buildMockSession({ now: options.focus }),
    notes: options.focus === null ? [] : [note],
    pullRequests: [{ ref: 'acme/tool#4', opened: '2026-03-10T08:43:00Z', result: 'OPEN' }],
    items: [
      ...buildMockIDs('task', options.taskCount).map((id) => buildMockItem({ id, claim })),
      ...buildMockIDs('wait', 4).map((id) =>
        buildMockItem({ id, kind: 'wait', claim, extra: { who: 'owner' } }),
      ),
      buildMockItem({ id: 'ok-a', kind: 'ok', claim, extra: { who: 'owner', scope: 'api' } }),
      ...buildMockIDs('rule', 5).map((id) => buildMockItem({ id, kind: 'rule', claim })),
      ...buildMockIDs('here', 4).map((id) => buildMockItem({ id, kind: 'where', claim })),
    ],
  });
}
