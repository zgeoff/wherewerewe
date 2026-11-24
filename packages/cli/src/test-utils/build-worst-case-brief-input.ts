import { match } from 'ts-pattern';
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

  // the grant at 700 characters of words and 19 lines: 7 bullets of 90 and 5 of 6 under a scope of
  // 40 (the default), one long bullet under a scope of 40, or one long bullet with no scope
  readonly grant?: 'wide-bullets' | 'long-bullet' | 'long-bullet-no-scope';

  // why the next step of the item in focus hides; the step prints when it is left out
  readonly nowHidden?: BriefInput['nowHidden'];

  // `unchecked` gives each item and pull request a result of that word from this read
  readonly results?: 'none' | 'unchecked';
}

// brief.md's worst case: every section at its widest, each task at its widest tag, the item in
// focus the first task, and as many tasks as the options name.
const shortWords = [...Array.from({ length: 21 }, () => 'goalword'), 'goalwordsss'];
const longWords = [...Array.from({ length: 3 }, () => 'g'.repeat(49)), 'g'.repeat(50)];

export function buildWorstCaseBriefInput(options: WorstCaseOptions): BriefInput {
  const result = 'r'.repeat(15);
  const waits = buildMockIDs('wait', 8);
  const tasks = buildMockIDs('task', options.taskCount);

  const ids = [
    ...tasks,
    ...waits,
    ...buildMockIDs('appr', 1),
    ...buildMockIDs('rule', 15),
    ...buildMockIDs('here', 8),
  ];

  const items = [
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
    ...buildMockIDs('rule', 15).map((id) =>
      buildMockItem({ id, kind: 'rule', claim: 'c'.repeat(120) }),
    ),
    ...buildMockIDs('here', 8).map((id) =>
      buildMockItem({ id, kind: 'where', claim: 'c'.repeat(120), check: 'pid:4', last: result }),
    ),
  ];

  const pullRequests = Array.from({ length: 10 }, () => ({
    ref: 'p'.repeat(60),
    opened: '2026-03-10T08:43:00Z',
    result,
  }));

  return buildMockBriefInput({
    host: options.host,
    session: {
      format: '2',
      grant: {
        ...buildGrantWords(options.grant ?? 'wide-bullets'),
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
    words: buildMockIDs('word', 8).map((id) => ({
      id,
      words: 'w'.repeat(300),
      where: 'w'.repeat(16),
      written: '2026-03-04T09:00:00Z',
      by: 'owner' as const,
    })),
    promises: buildMockIDs('prom', 5).map((id) => ({
      id,
      what: 'p'.repeat(120),
      to: 't'.repeat(16),
      byWhen: 'b'.repeat(24),
      written: '2026-03-04T09:00:00Z',
      by: 'agent' as const,
    })),
    lessons: buildMockIDs('less', 5).map((id) => ({
      id,
      text: 'l'.repeat(120),
      why: 'y'.repeat(200),
      written: '2026-03-04T09:00:00Z',
      by: 'agent' as const,
    })),
    decisions: Array.from({ length: 6 }, (_value, index) => ({
      id: `d-${String(99 - index)}`,
      choice: 'd'.repeat(200),
    })),
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
    items,
    pullRequests,
    checks: {
      kind: 'ran',
      count: 99,
      seconds: 99.9,
      unchecked: { count: 99, reason: 'u'.repeat(30) },
    },
    resultsNotSaved: 'not-writable',
    nowHidden: options.nowHidden ?? null,
    results:
      options.results === 'unchecked'
        ? new Map(
            [...items.map((item) => item.id), ...pullRequests.map((row) => row.ref)].map(
              (id) => [id, 'unchecked'] as const,
            ),
          )
        : new Map(),
  });
}

type WorstCaseGrant = Pick<
  BriefInput['session']['grant'] & object,
  'may' | 'not' | 'never' | 'scope'
>;

function buildGrantWords(layout: NonNullable<WorstCaseOptions['grant']>): WorstCaseGrant {
  return match(layout)
    .with('wide-bullets', () => ({
      may: Array.from({ length: 7 }, () => 'm'.repeat(90)),
      not: Array.from({ length: 5 }, () => 'x'.repeat(6)),
      never: [],
      scope: 's'.repeat(40),
    }))
    .with('long-bullet', () => ({
      may: [buildSpacedText(631, 74), ...Array.from({ length: 9 }, () => 'm')],
      not: [],
      never: Array.from({ length: 2 }, () => 'n'.repeat(10)),
      scope: 's'.repeat(40),
    }))
    .with('long-bullet-no-scope', () => ({
      may: [buildSpacedText(651, 74), ...Array.from({ length: 9 }, () => 'm')],
      not: [],
      never: Array.from({ length: 2 }, () => 'n'.repeat(20)),
      scope: null,
    }))
    .exhaustive();
}
