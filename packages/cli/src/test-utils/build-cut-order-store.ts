import type { BriefInput } from '../brief/types.ts';
import { buildMockBriefInput } from './build-mock-brief-input.ts';
import { buildMockItem } from './build-mock-item.ts';
import { buildMockSession } from './build-mock-session.ts';

// A brief input with one row in every rank of the cut order, and the mark that names each row's
// line, in the order the cut takes them.
export function buildCutOrderStore(): {
  readonly input: BriefInput;
  readonly order: readonly string[];
} {
  const input = buildMockBriefInput({
    session: buildMockSession({ now: 't-focus' }),
    items: [
      buildMockItem({ id: 't-focus', claim: 'Focus claim' }),
      buildMockItem({ id: 't-b', claim: 'Second claim' }),
      buildMockItem({ id: 'w-oth', kind: 'wait', claim: 'Other wait', extra: { who: 'vendor' } }),
      buildMockItem({ id: 'w-own', kind: 'wait', claim: 'Owner wait', extra: { who: 'owner' } }),
      buildMockItem({
        id: 'ok-a',
        kind: 'ok',
        claim: 'merge once',
        extra: { who: 'owner', scope: 'api' },
      }),
      buildMockItem({ id: 'r-a', kind: 'rule', claim: 'Rule claim' }),
      buildMockItem({ id: 'wh-a', kind: 'where', claim: 'Where claim' }),
    ],
    words: [
      {
        id: 'w-plain',
        words: 'Plain words',
        where: 'chat',
        written: '2026-03-04T11:43:00Z',
        by: 'owner',
      },
    ],
    promises: [
      {
        id: 'due-x',
        what: 'A promise',
        to: 'owner',
        byWhen: 'Friday',
        written: '2026-03-04T11:43:00Z',
        by: 'agent',
      },
    ],
    lessons: [
      {
        id: 'l-a',
        text: 'A lesson',
        why: 'A mistake',
        written: '2026-03-04T11:43:00Z',
        by: 'agent',
      },
    ],
    decisions: [
      { id: 'd-2', choice: 'Newer choice' },
      { id: 'd-1', choice: 'Older choice' },
    ],
    pullRequests: [{ ref: 'acme/tool#1', opened: '2026-03-10T08:43:00Z', result: 'OPEN' }],
  });

  // the row of each rank in the order the cut takes them, each named by a mark of its line
  const order = [
    'acme/tool#1',
    'due-x',
    'wh-a',
    't-b',
    'w-oth',
    'd-1',
    'd-2',
    'l-a',
    'r-a',
    'ok-a',
    'w-own',
    'w-plain',
  ];

  return { input, order };
}
