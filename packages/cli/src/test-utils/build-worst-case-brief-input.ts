import type { BriefInput } from '../brief/types.ts';
import { buildMockBriefInput } from './build-mock-brief-input.ts';
import { buildMockIDs } from './build-mock-ids.ts';
import { buildMockItem } from './build-mock-item.ts';
import { buildSpacedText } from './build-spaced-text.ts';

export interface WorstCaseOptions {
  readonly host: BriefInput['host'];
  readonly taskCount: number;

  // 200 characters in words of 8, or in words of 49 that wrap on a line each
  readonly goal?: 'short' | 'long';
}

// brief.md's worst case: every section at its widest, each task at its widest tag, the item in
// focus the first task, and as many tasks as the options name.
const shortWords = [...Array.from({ length: 21 }, () => 'goalword'), 'goalwordsss'];
const longWords = [...Array.from({ length: 3 }, () => 'g'.repeat(49)), 'g'.repeat(50)];

export function buildWorstCaseBriefInput(options: WorstCaseOptions): BriefInput {
  const result = 'r'.repeat(15);
  const waits = buildMockIDs('wait', 4);
  const tasks = buildMockIDs('task', options.taskCount);

  const ids = [
    ...tasks,
    ...waits,
    ...buildMockIDs('appr', 1),
    ...buildMockIDs('rule', 5),
    ...buildMockIDs('here', 4),
  ];

  return buildMockBriefInput({
    host: options.host,
    session: {
      format: '2',
      grant: {
        may: Array.from({ length: 7 }, () => 'm'.repeat(90)),
        not: Array.from({ length: 5 }, () => 'x'.repeat(6)),
        never: [],
        scope: 's'.repeat(40),
        reading: buildSpacedText(200),
        where: 'w'.repeat(16),
        set: '2026-03-03T09:00:00Z',
      },
      name: 'n'.repeat(24),
      goal: (options.goal === 'long' ? longWords : shortWords).join(' '),
      started: '2026-03-02T08:04:11Z',
      now: tasks[0] ?? '',
      nowNext: 'n'.repeat(120),
      nowSet: '2026-03-10T11:40:00Z',
      lastWrite: '2026-03-10T11:02:00Z',
      lastNudge: null,
      importedFrom: null,
    },
    ownerNotes: [
      { id: 'o-1', text: 'o'.repeat(160), said: '2026-03-10T09:40:12Z', on: tasks[1] ?? null },
      { id: 'o-2', text: 'o'.repeat(160), said: '2026-03-10T09:40:12Z', on: tasks[2] ?? null },
    ],
    notes: ids.map((id) => ({
      id,
      owed: true,
      written: '2026-03-10T09:00:00Z',
      note: [...Array.from({ length: 4 }, () => 'n'.repeat(81)), 'n'.repeat(72)].join(' '),
    })),
    changed: buildMockIDs('chng', 10).map((id) => ({
      item: buildMockItem({ id, check: 'pid:4', atWrite: result }),
      result: 'gone',
    })),
    items: [
      ...tasks.map((id) =>
        buildMockItem({
          id,
          claim: 'c'.repeat(120),
          check: 'pid:4',
          last: result,
          extra: { blocked_by: waits[0] ?? '' },
        }),
      ),
      ...waits.map((id) =>
        buildMockItem({
          id,
          kind: 'wait',
          claim: 'c'.repeat(120),
          check: 'pid:4',
          last: result,
          extra: { who: 'w'.repeat(16) },
        }),
      ),
      ...buildMockIDs('appr', 1).map((id) =>
        buildMockItem({
          id,
          kind: 'ok',
          claim: 'q'.repeat(120),
          extra: { who: 'owner', scope: 's'.repeat(40) },
        }),
      ),
      ...buildMockIDs('rule', 5).map((id) =>
        buildMockItem({ id, kind: 'rule', claim: 'c'.repeat(120) }),
      ),
      ...buildMockIDs('here', 4).map((id) =>
        buildMockItem({ id, kind: 'where', claim: 'c'.repeat(120), check: 'pid:4', last: result }),
      ),
    ],
    pullRequests: Array.from({ length: 10 }, () => ({
      ref: 'p'.repeat(60),
      opened: '2026-03-10T08:43:00Z',
      result,
    })),
    checks: {
      kind: 'ran',
      count: 99,
      seconds: 99.9,
      unchecked: { count: 99, reason: 'u'.repeat(30) },
    },
    resultsNotSaved: 'not-writable',
  });
}
