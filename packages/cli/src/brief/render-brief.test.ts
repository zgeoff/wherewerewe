import { expect, test } from 'bun:test';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildOverLimitBriefInput } from '../test-utils/build-over-limit-brief-input.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { buildWorstCaseBriefInput } from '../test-utils/build-worst-case-brief-input.ts';
import { collectBriefSections } from '../test-utils/collect-brief-sections.ts';
import { pickPrintedTaskIDs, renderBrief } from './render-brief.ts';

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
      `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
      'NOW  pr-api-77 · set 1h ago',
      '  next: watch CI, then request review',
      'OPEN (2 of 30)',
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
    `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
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
    `GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"`,
    'NOW  task-with-a-long-id · set 3m ago',
    '  next: go',
    'OPEN (2 of 30)',
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
    '  and 2 more; each shows its result below, or in the list of open tasks',
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
  {
    title: 'Codex, 6 tasks, goal of 3 lines',
    host: 'codex',
    taskCount: 6,
    goal: 'short',
    goalLines: 3,
    taskRows: 6,
    hasCountLine: false,
    maxLines: 73,
    maxCharacters: 7200,
  },
  {
    title: 'Codex, 6 tasks, goal in long words',
    host: 'codex',
    taskCount: 6,
    goal: 'long',
    goalLines: 3,
    taskRows: 6,
    hasCountLine: false,
    maxLines: 73,
    maxCharacters: 7200,
  },
  {
    title: 'Codex, 30 tasks',
    host: 'codex',
    taskCount: 30,
    goal: 'short',
    goalLines: 3,
    taskRows: 5,
    hasCountLine: true,
    maxLines: 73,
    maxCharacters: 7200,
  },
  {
    title: 'no known host, 30 tasks',
    host: null,
    taskCount: 30,
    goal: 'short',
    goalLines: 3,
    taskRows: 5,
    hasCountLine: true,
    maxLines: 73,
    maxCharacters: 7200,
  },
  {
    title: 'Claude Code, 15 tasks',
    host: 'claude',
    taskCount: 15,
    goal: 'short',
    goalLines: 3,
    taskRows: 15,
    hasCountLine: false,
    maxLines: 82,
    maxCharacters: 9000,
  },
  {
    title: 'Claude Code, 30 tasks',
    host: 'claude',
    taskCount: 30,
    goal: 'short',
    goalLines: 3,
    taskRows: 14,
    hasCountLine: true,
    maxLines: 82,
    maxCharacters: 9000,
  },
] as const)('it renders the worst case for $title within its budget', (row) => {
  const brief = renderBrief(
    buildWorstCaseBriefInput({ host: row.host, taskCount: row.taskCount, goal: row.goal }),
  );

  const lines = brief.split('\n');
  const characters = Array.from(brief, (character) => character).length;

  expect({
    goalCharacters: 200,
    lines: lines.length - 1,
    isWithinLimit: characters <= row.maxCharacters,
    goalLines: lines.filter((line) => line.startsWith('GOAL  ') || /^ {6}\S/u.test(line)).length,
    taskRows: lines.filter((line) => /^ {2}task\d\d/u.test(line)).length,
    firstTaskRow: lines[lines.findIndex((line) => line.startsWith('OPEN (')) + 1]?.slice(0, 8),
    countLines: lines.filter((line) => line.includes('more open tasks: www show')).length,
    hasCutLine: brief.includes('lines cut to fit; run www show <id>)'),
    noteLines: lines.filter((line) => /^ {4}n+$/u.test(line)).length,
  }).toStrictEqual({
    goalCharacters: 200,
    lines: row.maxLines,
    isWithinLimit: true,
    goalLines: row.goalLines,
    taskRows: row.taskRows,
    firstTaskRow: '  task01',
    countLines: row.hasCountLine ? 1 : 0,
    hasCutLine: false,
    noteLines: 5,
  });
});

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
    isWithinLimit: Array.from(brief, (character) => character).length <= 7000,
    keepsHeader: lines[0]?.startsWith('tide-alerts · day 9'),
    keepsOwner: brief.includes('OWNER SAYS (1)') && brief.includes('o-1  Ask me first.'),
    keepsChanged: brief.includes('CHANGED SINCE WRITTEN (1)'),
    keepsNow: brief.includes('NOW  none.'),
    keepsGoal: brief.includes('GOAL  Ship tide alerts'),
    endsWithFooter: lines.at(-2)?.startsWith('Write as you go:'),
    hasCutLine: brief.includes('lines cut to fit; run www show <id>)'),
    keepsFirstTask: brief.includes('task-5'),
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
  const mayBullet = buildSpacedText(120).replaceAll('g', 'x');
  const may = Array.from({ length: 5 }, () => mayBullet);
  const reading = buildSpacedText(200);
  const not = buildSpacedText(60).replaceAll('g', 'k');
  const scope = 's'.repeat(40);

  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({
        grant: {
          may,
          not: [not],
          never: [],
          scope,
          reading,
          where: 'chat',
          set: '2026-03-03T09:00:00Z',
        },
      }),
      items: [
        ...buildMockIDs('task', 12).map((id) => buildMockItem({ id, claim: 'c'.repeat(120) })),
        ...buildMockIDs('rule', 10).map((id) =>
          buildMockItem({ id, kind: 'rule', claim: 'c'.repeat(900) }),
        ),
      ],
    }),
  );

  const lines = brief.split('\n');
  const cutAt = lines.findIndex((line) => line.includes('lines cut to fit; run www show <id>)'));

  const grantLines = lines.filter((line) =>
    /^(?:GRANT {2}| {2}(?:may|not) +• | {9}• | {11}[xk]| {2}reading: | {4}g)/u.test(line),
  );

  expect({
    isWithinLines: lines.length - 1 <= 73,
    isWithinLimit: Array.from(brief, (character) => character).length <= 7200,
    grantLines: grantLines.length,
    mayCharacters: grantLines.join('').split('x').length - 1,
    notCharacters: grantLines.join('').split('k').length - 1,
    cutEndsLastSection: lines[cutAt - 1]?.startsWith('  rule'),
    footerFollowsCut: lines[cutAt + 1]?.startsWith('Write as you go:'),
  }).toStrictEqual({
    isWithinLines: true,
    isWithinLimit: true,
    grantLines: 15,
    mayCharacters: 5 * 115,
    notCharacters: 58,
    cutEndsLastSection: true,
    footerFollowsCut: true,
  });
});

test('it orders the tasks as the day-9 example does: focus, changed, blocked and owed, then newest', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({ now: 'pr-api-77' }),
      items: [
        buildMockItem({ id: 'pr-tk-19', written: '2026-03-09T09:00:00Z' }),
        buildMockItem({ id: 't-e2e', written: '2026-03-07T11:43:00Z' }),
        buildMockItem({
          id: 't-flag',
          written: '2026-03-08T11:43:00Z',
          extra: { blocked_by: 'w-apns' },
        }),
        buildMockItem({
          id: 'pr-app-61',
          check: 'pid:4',
          atWrite: 'alive',
          written: '2026-03-01T11:43:00Z',
        }),
        buildMockItem({ id: 'pr-api-77', written: '2026-03-02T11:43:00Z' }),
        buildMockItem({ id: 'w-apns', kind: 'wait', extra: { who: 'owner' } }),
      ],
      notes: [buildMockNote({ id: 't-flag', owed: true })],
      changed: [
        {
          item: buildMockItem({ id: 'pr-app-61', check: 'pid:4', atWrite: 'alive' }),
          result: 'gone',
        },
      ],
    }),
  );

  expect(
    brief
      .split('\n')
      .filter((line) => /^ {2}(?:pr-|t-)/u.test(line) && !line.includes(' was '))
      .map((line) => line.slice(2, 11).trim()),
  ).toStrictEqual(['pr-api-77', 'pr-app-61', 't-flag', 'pr-tk-19', 't-e2e']);
});

test('it prints every task and no count line when a brief with room holds 20', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      host: 'claude',
      items: buildMockIDs('task', 20).map((id) => buildMockItem({ id })),
    }),
  );

  expect({
    heading: brief.includes('OPEN (20 of 30)\n'),
    rows: brief.split('\n').filter((line) => line.startsWith('  task')).length,
    hasCountLine: brief.includes('more open tasks'),
  }).toStrictEqual({ heading: true, rows: 20, hasCountLine: false });
});

test('it prints 5 rows of the order and a count line for 7 tasks in the worst case', () => {
  const input = buildWorstCaseBriefInput({ host: 'codex', taskCount: 7 });
  const brief = renderBrief(input);

  expect({
    printed: pickPrintedTaskIDs(input),
    rows: brief
      .split('\n')
      .filter((line) => /^ {2}task\d\d/u.test(line))
      .map((line) => line.slice(2, 8)),
    countLine: brief.split('\n').find((line) => line.includes('more open tasks')),
  }).toStrictEqual({
    printed: ['task01', 'task07', 'task06', 'task05', 'task04'].map((id) => id.padEnd(16, 'x')),
    rows: ['task01', 'task07', 'task06', 'task05', 'task04'],
    countLine: '  and 2 more open tasks: www show',
  });
});

test.each([
  { sessionFlag: null, expected: '  and 25 more open tasks: www show' },
  {
    sessionFlag: 'n'.repeat(24),
    expected: `  and 25 more open tasks: www --session ${'n'.repeat(24)} show`,
  },
])('it prints the count line $expected for a session flag of $sessionFlag', (row) => {
  const brief = renderBrief(buildWorstCaseBriefInput({ host: 'codex', taskCount: 30 }));

  const withFlag = renderBrief({
    ...buildWorstCaseBriefInput({ host: 'codex', taskCount: 30 }),
    sessionFlag: row.sessionFlag,
  });

  expect(brief).toBeString();
  expect(withFlag.split('\n').find((line) => line.includes('more open tasks'))).toBe(row.expected);
});

test('it prints the changed overflow line that names the list of open tasks', () => {
  const brief = renderBrief(
    buildMockBriefInput({
      changed: buildMockIDs('chng', 4).map((id) => ({
        item: buildMockItem({ id, check: 'pid:4', atWrite: 'alive' }),
        result: 'gone',
      })),
    }),
  );

  expect(brief).toInclude(
    '  and 1 more; each shows its result below, or in the list of open tasks\n',
  );
});

test('it moves a task left out of the rows up when its saved result differs from the one written', () => {
  const ids = buildMockIDs('task', 30);
  const input = buildWorstCaseBriefInput({ host: 'codex', taskCount: 30 });

  const items = input.items.map((item) =>
    item.id === ids[10] ? { ...item, atWrite: 'alive', last: 'gone' } : item,
  );

  expect(pickPrintedTaskIDs({ ...input, items }).slice(0, 2)).toStrictEqual(
    ['task01', 'task11'].map((id) => id.padEnd(16, 'x')),
  );
});

test('it keeps a task with a saved result equal to the one written, or unchecked, out of the changed group', () => {
  const ids = buildMockIDs('task', 30);
  const input = buildWorstCaseBriefInput({ host: 'codex', taskCount: 30 });

  const items = input.items.map((item) =>
    item.id === ids[10] ? { ...item, atWrite: 'alive', last: 'unchecked' } : item,
  );

  expect(pickPrintedTaskIDs({ ...input, items })).not.toContain(ids[10]);
});

test.each([6, 12])(
  'it cuts the pull request, where and rule rows before a task row with %p tasks over the limits',
  (taskCount) => {
    const brief = renderBrief(buildOverLimitBriefInput({ taskCount, focus: null }));

    expect({
      sections: collectBriefSections(brief),
      taskRows: brief.split('\n').filter((line) => line.startsWith('  task')).length,
    }).toStrictEqual({
      sections: ['OPEN', 'WAITING', 'APPROVED ONCE', 'RULES'],
      taskRows: taskCount === 6 ? 6 : 5,
    });
  },
);

test('it stops the fill at 5 rows and a count line for 12 tasks, and the cut then takes rows above the count line', () => {
  const lines = renderBrief(
    buildOverLimitBriefInput({ taskCount: 12, focus: null, claimLength: 1500 }),
  ).split('\n');

  const countAt = lines.findIndex((line) => line.includes('more open tasks'));

  expect({
    countLine: lines[countAt],
    cutLine: lines[countAt + 1],
    rowsAboveCount: lines.slice(0, countAt).filter((line) => line.startsWith('  task')).length,
    cutLines: lines.filter((line) => line.includes('lines cut to fit')).length,
  }).toStrictEqual({
    countLine: '  and 7 more open tasks: www show',
    cutLine: expect.stringMatching(/^ {2}\(\d+ lines cut to fit; run www show <id>\)$/u),
    rowsAboveCount: expect.toBeWithin(1, 5),
    cutLines: 1,
  });
});

test('it keeps the focus row and the count line when the cut takes every other task row', () => {
  const lines = renderBrief(
    buildOverLimitBriefInput({ taskCount: 12, focus: 'task03xxxxxxxxxx', claimLength: 4000 }),
  ).split('\n');

  const openAt = lines.findIndex((line) => line.startsWith('OPEN ('));

  expect(lines.slice(openAt, openAt + 3)).toStrictEqual([
    'OPEN (12 of 30)',
    expect.stringMatching(/^ {2}task03xxxxxxxxxx {2}c+ {2}\[no check · 1h\]$/u),
    expect.stringMatching(/^ {2}and 7 more open tasks: www show$/u),
  ]);

  expect(lines.join('\n')).toInclude('    Keep this note whole\n');
});

test('it keeps the row of a wait in focus, and the whole note, after every task row is cut', () => {
  const brief = renderBrief(
    buildOverLimitBriefInput({ taskCount: 6, focus: 'wait01xxxxxxxxxx', claimLength: 4000 }),
  );

  expect({
    sections: collectBriefSections(brief),
    focusRow: brief.split('\n').filter((line) => line.startsWith('  wait01')).length,
    note: brief.includes('    Keep this note whole\n'),
  }).toStrictEqual({ sections: ['WAITING'], focusRow: 1, note: true });
});

test('it leaves OPEN and its count line out when no task is in focus and every task row is cut', () => {
  const claim = 'c'.repeat(9000);

  const brief = renderBrief(
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 'rule-a', kind: 'rule', claim }),
        buildMockItem({ id: 't-a', claim }),
        buildMockItem({ id: 't-b', claim }),
      ],
    }),
  );

  expect({
    sections: collectBriefSections(brief),
    hasCountLine: brief.includes('more open tasks'),
  }).toStrictEqual({ sections: [], hasCountLine: false });
});

test('it prints a brief over its budget when only the focus row and the note are left to cut', () => {
  const claim = 'c'.repeat(9000);

  const brief = renderBrief(
    buildMockBriefInput({
      session: buildMockSession({ now: 't-a' }),
      notes: [buildMockNote({ id: 't-a', note: 'Keep this note whole' })],
      items: [
        buildMockItem({ id: 't-a', claim }),
        buildMockItem({ id: 'rule-a', kind: 'rule', claim }),
        buildMockItem({ id: 'rule-b', kind: 'rule', claim }),
      ],
    }),
  );

  const lines = brief.split('\n');

  expect({
    focusRow: lines.filter((line) => line.startsWith('  t-a')).length,
    note: brief.includes('    Keep this note whole\n'),
    cutLine: lines.find((line) => line.includes('lines cut to fit')),
  }).toStrictEqual({
    focusRow: 1,
    note: true,
    cutLine: '  (2 lines cut to fit; run www show <id>)',
  });
});
