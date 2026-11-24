import { expect, test } from 'bun:test';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { renderBrief } from './render-brief.ts';

test('it renders each section of one invented store in order', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: {
        format: '2',
        grant: null,
        name: 'tide-alerts',
        goal: 'Ship tide alerts in bosun-api and bosun-app.',
        started: '2026-03-02T08:04:11Z',
        now: 'pr-api-77',
        nowNext: 'watch CI, then request review',
        nowSet: '2026-03-10T10:43:00Z',
        lastWrite: '2026-03-10T11:02:00Z',
        lastNudge: null,
        importedFrom: null,
      },
      checks: { kind: 'not-run', count: 1 },
      items: [
        buildMockItem({
          id: 't-e2e',
          claim: 'Write alerts-e2e against staging',
          written: '2026-03-07T11:43:00Z',
        }),
        buildMockItem({
          id: 'pr-api-77',
          claim: 'Alert job retries a 503',
          check: 'pr:bosunhq/bosun-api#77',
        }),
        buildMockItem({
          id: 'w-apns',
          kind: 'wait',
          claim: 'upload the staging push key to the vault',
          written: '2026-03-08T11:43:00Z',
          extra: { who: 'owner' },
        }),
        buildMockItem({
          id: 'ok-merge',
          kind: 'ok',
          claim: 'merge the alert PRs yourself once CI is green',
          extra: { who: 'owner', scope: 'bosun-api, bosun-app' },
        }),
        buildMockItem({ id: 'r-api-tests', kind: 'rule', claim: 'Run the API tests from api/' }),
        buildMockItem({
          id: 's-staging',
          kind: 'where',
          claim: 'staging secrets live in the vault bosun-staging',
          written: '2026-03-10T10:43:00Z',
        }),
      ],
    }),
  );

  expect(brief).toBe(
    [
      'tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write 41m ago · 1 checks, not run yet',
      'GOAL  Ship tide alerts in bosun-api and bosun-app.',
      `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
      'NOW  pr-api-77 · set 1h ago',
      '  next: watch CI, then request review',
      'OPEN (2 of 6)',
      '  pr-api-77   Alert job retries a 503  [not checked yet]',
      '  t-e2e       Write alerts-e2e against staging  [no check · 3d]',
      'WAITING (1 of 4)',
      '  w-apns      upload the staging push key to the vault  [owner · 2d]',
      'APPROVED ONCE (1 of 1)',
      '  ok-merge    "merge the alert PRs yourself once CI is green" · bosun-api, bosun-app',
      'RULES (1 of 5)',
      '  r-api-tests Run the API tests from api/',
      'WHERE (1 of 4)',
      '  s-staging   staging secrets live in the vault bosun-staging  [no check · 1h]',
      'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
      '',
    ].join('\n'),
  );
});

test('it leaves empty sections out and says NOW is none with the command to set it', () => {
  const brief = renderBrief(buildMockBriefInput({}));

  expect(brief.split('\n').slice(0, 4)).toStrictEqual([
    'tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write 41m ago · no checks',
    'GOAL  Ship tide alerts in bosun-api and bosun-app.',
    `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
    'NOW  none. Run: www now <id> "<next step>"',
  ]);

  expect(brief).not.toContain('OPEN');
});

test.each([
  ['a task with a check not yet run', { check: 'pid:42' }, '[not checked yet]'],
  ['a task with a saved result', { check: 'pid:42', last: 'alive' }, '[alive]'],
  ['a task with no check', {}, '[no check · 5h]'],
  ['a task blocked by an open wait', { extra: { blocked_by: 'w-a' } }, '[blocked by w-a]'],
  [
    'a blocked task with a check',
    { check: 'pid:42', extra: { blocked_by: 'w-a' } },
    '[blocked by w-a · not checked yet]',
  ],
  ['a task blocked by a closed id', { extra: { blocked_by: 'gone-id' } }, '[no check · 5h]'],
])('it tags %s', (_title, fields, tag) => {
  const brief = renderBrief(
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
        buildMockItem({ id: 't-a', written: '2026-03-10T06:43:00Z', ...fields }),
      ],
    }),
  );

  expect(brief).toInclude(`  t-a         Write the parser  ${tag}\n`);
});

test.each([
  ['a wait with a check not yet run', { check: 'pid:42' }, '[owner · not checked yet]'],
  ['a wait with a saved result', { check: 'pid:42', last: 'gone' }, '[owner · gone]'],
  ['a wait with no check', {}, '[owner · 5h]'],
])('it tags %s', (_title, fields, tag) => {
  const brief = renderBrief(
    buildMockBriefInput({
      items: [
        buildMockItem({
          id: 'w-a',
          kind: 'wait',
          written: '2026-03-10T06:43:00Z',
          extra: { who: 'owner' },
          ...fields,
        }),
      ],
    }),
  );

  expect(brief).toInclude(`  w-a         Write the parser  ${tag}\n`);
});

test.each([
  ['a where item with a check not yet run', { check: 'path:/srv/app' }, '[not checked yet]'],
  ['a where item with a saved result', { check: 'path:/srv/app', last: 'clean' }, '[clean]'],
  ['a where item with no check', {}, '[no check · 5h]'],
])('it tags %s', (_title, fields, tag) => {
  const brief = renderBrief(
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 'wt-a', kind: 'where', written: '2026-03-10T06:43:00Z', ...fields }),
      ],
    }),
  );

  expect(brief).toInclude(`  wt-a        Write the parser  ${tag}\n`);
});

test('it puts the item in focus first among the tasks and pads a long id with two spaces', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: {
        format: '2',
        grant: null,
        name: 'tide-alerts',
        goal: 'Ship it',
        started: '2026-03-02T08:04:11Z',
        now: 'task-with-a-long-id',
        nowNext: 'go',
        nowSet: '2026-03-10T11:40:00Z',
        lastWrite: null,
        lastNudge: null,
        importedFrom: null,
      },
      items: [
        buildMockItem({ id: 't-first', written: '2026-03-10T11:43:00Z' }),
        buildMockItem({ id: 'task-with-a-long-id', written: '2026-03-10T11:43:00Z' }),
      ],
    }),
  );

  expect(brief.split('\n').slice(0, 9)).toStrictEqual([
    'tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write never · no checks',
    'GOAL  Ship it',
    `GRANT  none. Run: www grant --quote "<the owner's words, whole>" --where <where> --reading "<what they cover; what the owner kept back>"`,
    'NOW  task-with-a-long-id · set 3m ago',
    '  next: go',
    'OPEN (2 of 6)',
    '  task-with-a-long-id  Write the parser  [no check · 0m]',
    '  t-first     Write the parser  [no check · 0m]',
    'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
  ]);
});

test.each([
  [
    'checks that ran',
    { kind: 'ran', count: 7, seconds: 2.84, unchecked: null } as const,
    '7 checks in 2.8s',
  ],
  [
    'checks that ran with some unchecked',
    { kind: 'ran', count: 7, seconds: 2.8, unchecked: { count: 2, reason: 'no gh' } } as const,
    '7 checks in 2.8s · 2 unchecked: no gh',
  ],
  ['no checks', { kind: 'none' } as const, 'no checks'],
])('it writes the header for %s', (_title, checks, tail) => {
  const brief = renderBrief(buildMockBriefInput({ checks }));

  expect(brief.split('\n')[0]).toBe(
    `tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write 41m ago · ${tail}`,
  );
});

test.each([
  ['not-writable', '  results not saved: the store is not writable here'] as const,
  ['lock-held', '  results not saved: another write held the lock'] as const,
])('it adds the second header line for %s', (resultsNotSaved, line) => {
  const brief = renderBrief(buildMockBriefInput({ resultsNotSaved }));

  expect(brief.split('\n')[1]).toBe(line);
});

test('it renders owner notes, changed rows with their overflow, and pull requests with theirs', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      ownerNotes: [
        { id: 'o-2', text: 'Ask me first.', said: '2026-03-10T09:40:12Z', on: null },
        { id: 'o-3', text: 'Mind the cert.', said: '2026-03-10T09:40:12Z', on: 'pr-api-77' },
      ],
      changed: [
        {
          item: buildMockItem({ id: 'a-1', check: 'pr:acme/tool#1', atWrite: 'OPEN passing' }),
          result: 'MERGED',
        },
        { item: buildMockItem({ id: 'a-2', check: 'pid:4', atWrite: 'alive' }), result: 'gone' },
        {
          item: buildMockItem({ id: 'a-3', check: 'pr:acme/tool#3', atWrite: 'OPEN' }),
          result: 'OPEN failing',
        },
        {
          item: buildMockItem({ id: 'a-4', check: 'pr:acme/tool#4', atWrite: 'OPEN' }),
          result: 'CLOSED',
        },
        {
          item: buildMockItem({ id: 'a-5', check: 'pr:acme/tool#5', atWrite: 'OPEN' }),
          result: 'CLOSED',
        },
      ],
      pullRequests: [
        { ref: 'acme/tool#1', opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
        { ref: 'acme/tool#2', opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
        { ref: 'acme/tool#3', opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
        { ref: 'acme/tool#4', opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
      ],
    }),
  );

  expect(brief.split('\n').slice(3, 17)).toStrictEqual([
    'OWNER SAYS (2) · act on it; only the owner clears it',
    '  o-2  Ask me first.  [2h]',
    '  o-3  Mind the cert.  [on pr-api-77 · 2h]',
    'CHANGED SINCE WRITTEN (5) · these claims are no longer true',
    '  a-1         was OPEN passing (1h) · now MERGED · run: www done a-1 --evidence "merged, seen by check"',
    '  a-2         was alive (1h) · now gone · run: www drop a-2 --why "process gone, seen by check"',
    '  a-3         was OPEN (1h) · now OPEN failing · run: www set a-3 "<what is true now>"',
    '  and 2 more; each shows its result in its section below',
    'NOW  none. Run: www now <id> "<next step>"',
    'PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (4)',
    '  acme/tool#1  opened 3h ago  [OPEN pending]',
    '  and 3 more: www log --op pr',
    '  name each in an item: www task <id> "<claim>" --pr <owner>/<repo>#<n>',
    'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
  ]);
});

test('it cuts a pull request ref over 60 characters to 59 and an ellipsis', () => {
  const ref = `${'o'.repeat(30)}/${'r'.repeat(40)}#12`;

  const brief = renderBrief(
    buildMockBriefInput({
      pullRequests: [{ ref, opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' }],
    }),
  );

  expect(brief).toInclude(`  ${ref.slice(0, 59)}…  opened 3h ago  [OPEN pending]\n`);
});

test.each([
  [
    'a goal of 200 characters in short words, which wraps to 3 lines',
    [...Array.from({ length: 21 }, () => 'goalword'), 'goalwordsss'],
    3,
    false,
  ],
  [
    'a goal of 200 characters in words of 49, which wraps to 3 lines',
    [...Array.from({ length: 3 }, () => 'g'.repeat(49)), 'g'.repeat(50)],
    3,
    false,
  ],
])(
  'it renders the worst case with %s in 63 lines and at most 7,000 characters',
  (_title, words, goalLines, isCut) => {
    const result = 'r'.repeat(15);
    const waits = buildMockIDs('wait', 4);
    const tasks = buildMockIDs('task', 6);

    const ids = [
      ...tasks,
      ...waits,
      ...buildMockIDs('appr', 1),
      ...buildMockIDs('rule', 5),
      ...buildMockIDs('here', 4),
    ];

    const brief = renderBrief(
      buildMockBriefInput({
        session: {
          format: '2',
          grant: {
            words: buildSpacedText(700),
            reading: buildSpacedText(200),
            where: 'w'.repeat(16),
            set: '2026-03-03T09:00:00Z',
          },
          name: 'n'.repeat(24),
          goal: words.join(' '),
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
            buildMockItem({
              id,
              kind: 'where',
              claim: 'c'.repeat(120),
              check: 'pid:4',
              last: result,
            }),
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
      }),
    );

    expect({
      goalCharacters: words.join(' ').length,
      lines: brief.split('\n').length - 1,
      isWithinLimit: [...brief].length <= 7000,
      grantLines: brief
        .split('\n')
        .filter((line) => /^(?: {2}"| {3}g| {2}reading: | {4}g)/u.test(line)).length,
      goalLines: brief
        .split('\n')
        .filter((line) => line.startsWith('GOAL  ') || line.startsWith('      ')).length,
      hasCutLine: brief.includes('lines cut to fit; run www show <id>)'),
      noteLines: brief.split('\n').filter((line) => /^ {4}n+$/u.test(line)).length,
    }).toStrictEqual({
      goalCharacters: 200,
      lines: 63,
      isWithinLimit: true,
      grantLines: 12,
      goalLines,
      hasCutLine: isCut,
      noteLines: 5,
    });
  },
);

test('it cuts item lines from the bottom up when the text passes 7,000 characters, and keeps the rest', () => {
  const claim = 'c'.repeat(450);
  const ids = ['task-0', 'task-1', 'task-2', 'task-3', 'task-4', 'task-5'];

  const brief = renderBrief(
    buildMockBriefInput({
      ownerNotes: [{ id: 'o-1', text: 'Ask me first.', said: '2026-03-10T09:40:12Z', on: null }],
      changed: [
        { item: buildMockItem({ id: 'a-1', check: 'pid:4', atWrite: 'alive' }), result: 'gone' },
      ],
      items: [
        ...ids.map((id) => buildMockItem({ id, claim })),
        ...['w-1', 'w-2', 'w-3', 'w-4'].map((id) =>
          buildMockItem({ id, kind: 'wait', claim, extra: { who: 'owner' } }),
        ),
        ...['r-1', 'r-2', 'r-3', 'r-4', 'r-5'].map((id) =>
          buildMockItem({ id, kind: 'rule', claim }),
        ),
        ...['wt-1', 'wt-2', 'wt-3', 'wt-4'].map((id) =>
          buildMockItem({ id, kind: 'where', claim }),
        ),
      ],
    }),
  );

  const lines = brief.split('\n');

  expect({
    isWithinLimit: [...brief].length <= 7000,
    keepsHeader: lines[0]?.startsWith('tide-alerts · day 9'),
    keepsOwner: brief.includes('OWNER SAYS (1)') && brief.includes('o-1  Ask me first.'),
    keepsChanged: brief.includes('CHANGED SINCE WRITTEN (1)'),
    keepsNow: brief.includes('NOW  none.'),
    keepsGoal: brief.includes('GOAL  Ship tide alerts'),
    endsWithFooter: lines.at(-2)?.startsWith('Write as you go:'),
    hasCutLine: brief.includes('lines cut to fit; run www show <id>)'),
    keepsFirstTask: brief.includes('task-0'),
    keepsLastWhere: brief.includes('wt-4'),
  }).toStrictEqual({
    isWithinLimit: true,
    keepsHeader: true,
    keepsOwner: true,
    keepsChanged: true,
    keepsNow: true,
    keepsGoal: true,
    endsWithFooter: true,
    hasCutLine: true,
    keepsFirstTask: true,
    keepsLastWhere: false,
  });
});

test.each([
  [
    'a note',
    false,
    ['NOW  t-a · set 1h ago · note 1h ago', '  next: go', '    Stop the simulator'],
  ],
  [
    'an owed note',
    true,
    ['NOW  t-a · set 1h ago · owed note 1h ago', '  next: go', '    Stop the simulator'],
  ],
])('it prints %s whole under NOW after the next step', (_title, owed, expected) => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({}),
      items: [buildMockItem({ id: 't-a', written: '2026-03-10T10:31:00Z' })],
      notes: [{ id: 't-a', owed, written: '2026-03-10T10:43:00Z', note: 'Stop the simulator' }],
    }),
  );

  expect(brief.split('\n').slice(3, 6)).toStrictEqual(expected);
});

test('it prints the note under NOW when the item has no next step', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({ nowNext: null }),
      items: [buildMockItem({ id: 't-a' })],
      notes: [
        { id: 't-a', owed: false, written: '2026-03-10T10:43:00Z', note: 'Stop the simulator' },
      ],
    }),
  );

  expect(brief.split('\n').slice(3, 5)).toStrictEqual([
    'NOW  t-a · set 1h ago · note 1h ago',
    '    Stop the simulator',
  ]);
});

test('it prints only the note of the item in focus', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({}),
      items: [buildMockItem({ id: 't-a' }), buildMockItem({ id: 't-b' })],
      notes: [
        { id: 't-a', owed: false, written: '2026-03-10T10:43:00Z', note: 'Focus note' },
        { id: 't-b', owed: false, written: '2026-03-10T10:43:00Z', note: 'Other note' },
      ],
    }),
  );

  expect({
    focus: brief.includes('Focus note'),
    other: brief.includes('Other note'),
  }).toStrictEqual({
    focus: true,
    other: false,
  });
});

test('it tags every item with an owed note, the item in focus included, and no item without one', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({}),
      items: [
        buildMockItem({ id: 't-a' }),
        buildMockItem({ id: 't-b' }),
        buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
        buildMockItem({
          id: 'ok-a',
          kind: 'ok',
          claim: 'go ahead',
          extra: { who: 'owner', scope: 'api' },
        }),
        buildMockItem({ id: 'r-a', kind: 'rule' }),
        buildMockItem({ id: 'r-b', kind: 'rule' }),
        buildMockItem({ id: 'wt-a', kind: 'where' }),
      ],
      notes: [
        buildMockNote({ id: 't-a', owed: true }),
        buildMockNote({ id: 'w-a', owed: true }),
        buildMockNote({ id: 'ok-a', owed: true }),
        buildMockNote({ id: 'r-a', owed: true }),
        buildMockNote({ id: 'wt-a', owed: true }),
      ],
    }),
  );

  expect(brief.split('\n').filter((line) => line.includes('owed]'))).toStrictEqual([
    '  t-a         Write the parser  [no check · 1h · owed]',
    '  w-a         Write the parser  [owner · 1h · owed]',
    '  ok-a        "go ahead" · api  [owed]',
    '  r-a         Write the parser  [owed]',
    '  wt-a        Write the parser  [no check · 1h · owed]',
  ]);
});

test('it prints the grant whole and ends the last kept section with the cut line, when 12 tasks and 10 rules pass the limits', () => {
  const words = buildSpacedText(700);
  const reading = buildSpacedText(200);

  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({
        grant: {
          words,
          reading,
          where: 'chat',
          set: '2026-03-03T09:00:00Z',
        },
      }),
      items: [
        ...buildMockIDs('task', 12).map((id) => buildMockItem({ id, claim: 'c'.repeat(300) })),
        ...buildMockIDs('rule', 10).map((id) =>
          buildMockItem({ id, kind: 'rule', claim: 'c'.repeat(300) }),
        ),
      ],
    }),
  );

  const lines = brief.split('\n');
  const cutAt = lines.findIndex((line) => line.includes('lines cut to fit; run www show <id>)'));

  expect({
    isWithinLines: lines.length - 1 <= 63,
    isWithinLimit: [...brief].length <= 7000,
    grantLines: lines.filter((line) => /^(?: {2}"| {3}g| {2}reading: | {4}g)/u.test(line)).length,
    hasWholeWords: brief.includes(words.slice(0, 80)) && brief.includes(words.slice(-60)),
    cutEndsLastSection: lines[cutAt - 1]?.startsWith('  rule'),
    footerFollowsCut: lines[cutAt + 1]?.startsWith('Write as you go:'),
  }).toStrictEqual({
    isWithinLines: true,
    isWithinLimit: true,
    grantLines: 12,
    hasWholeWords: true,
    cutEndsLastSection: true,
    footerFollowsCut: true,
  });
});
