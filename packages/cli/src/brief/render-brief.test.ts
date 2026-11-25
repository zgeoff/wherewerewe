import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sortBriefEnd } from '../hooks/sort-brief-end.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildCutOrderStore } from '../test-utils/build-cut-order-store.ts';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildNeverCutInput } from '../test-utils/build-never-cut-input.ts';
import { buildThreeByteCutInput } from '../test-utils/build-three-byte-cut-input.ts';
import { buildWorstCaseBriefInput } from '../test-utils/build-worst-case-brief-input.ts';
import { collectBriefBlocks } from '../test-utils/collect-brief-blocks.ts';
import { collectBriefRows } from '../test-utils/collect-brief-rows.ts';
import { collectMissingRows } from '../test-utils/collect-missing-rows.ts';
import { hasBriefRow } from '../test-utils/has-brief-row.ts';
import { hasSecondArgument } from '../test-utils/has-second-argument.ts';
import { listTypeScriptFiles } from '../test-utils/list-type-script-files.ts';
import { readWorstCaseBlocks } from '../test-utils/read-worst-case-blocks.ts';
import { threeByteRanks } from '../test-utils/three-byte-ranks.ts';
import { threeByteSections } from '../test-utils/three-byte-sections.ts';
import { cutRanks } from './cut-ranks.ts';
import type { CutRank } from './cut-ranks.ts';
import { briefFooter } from './join-brief.ts';
import { renderBrief } from './render-brief.ts';

function setupTest() {
  return {
    render: renderBrief,
    readDoc: readWorstCaseBlocks,
    packageDir: join(import.meta.dir, '..', '..'),
  };
}

test('it renders each section of one invented store in order', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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
      'OPEN (2, max 30)',
      '  pr-api-77   Alert job retries a 503  [not checked yet]',
      '  t-e2e       Write alerts-e2e against staging  [no check · 3d]',
      'WAITING (1, max 8)',
      '  w-apns      upload the staging push key to the vault  [owner · 2d]',
      'APPROVED ONCE (1, max 1)',
      '  ok-merge    "merge the alert PRs yourself once CI is green" · bosun-api, bosun-app',
      'RULES (1, max 15)',
      '  r-api-tests Run the API tests from api/',
      'WHERE (1, max 8)',
      '  s-staging   staging secrets live in the vault bosun-staging  [no check · 1h]',
      'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
      '',
    ].join('\n'),
  );
});

test('it leaves empty sections out and says NOW is none with the command to set it', () => {
  const ctx = setupTest();
  const brief = ctx.render(buildMockBriefInput({}));

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
  const ctx = setupTest();

  const brief = ctx.render(
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
  const ctx = setupTest();

  const brief = ctx.render(
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
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 'wt-a', kind: 'where', written: '2026-03-10T06:43:00Z', ...fields }),
      ],
    }),
  );

  expect(brief).toInclude(`  wt-a        Write the parser  ${tag}\n`);
});

test('it puts the item in focus first among the tasks and pads a long id with two spaces', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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
    'OPEN (2, max 30)',
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
  const ctx = setupTest();
  const brief = ctx.render(buildMockBriefInput({ checks }));

  expect(brief.split('\n')[0]).toBe(
    `tide-alerts · day 9 · Tue 2026-03-10 11:43Z · last write 41m ago · ${tail}`,
  );
});

test.each([
  ['not-writable', '  results not saved: the store is not writable here'] as const,
  ['lock-held', '  results not saved: another write held the lock'] as const,
])('it adds the second header line for %s', (resultsNotSaved, line) => {
  const ctx = setupTest();
  const brief = ctx.render(buildMockBriefInput({ resultsNotSaved }));

  expect(brief.split('\n')[1]).toBe(line);
});

test('it renders owner notes, changed rows with their overflow, and pull requests with theirs', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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
    '  and 3 more: www list prs',
    '  name each in an item: www task <id> "<claim>" --pr <owner>/<repo>#<n>',
    'Write as you go: www set <id> "<claim>" --note "<detail>" · www decide, done or drop · www help',
  ]);
});

test('it cuts a pull request ref over 60 characters to 59 and an ellipsis', () => {
  const ctx = setupTest();
  const ref = `${'o'.repeat(30)}/${'r'.repeat(40)}#12`;

  const brief = ctx.render(
    buildMockBriefInput({
      pullRequests: [{ ref, opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' }],
    }),
  );

  expect(brief).toInclude(`  ${ref.slice(0, 59)}…  opened 3h ago  [OPEN pending]\n`);
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
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      session: buildMockSession({}),
      items: [buildMockItem({ id: 't-a', written: '2026-03-10T10:31:00Z' })],
      notes: [{ id: 't-a', owed, written: '2026-03-10T10:43:00Z', note: 'Stop the simulator' }],
    }),
  );

  expect(brief.split('\n').slice(3, 6)).toStrictEqual(expected);
});

test('it prints the note under NOW when the item has no next step', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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
  const ctx = setupTest();

  const brief = ctx.render(
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
  const ctx = setupTest();

  const brief = ctx.render(
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

test('it prints a grant of only not bullets under its heading, with no may line', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      host: 'codex',
      session: buildMockSession({
        grant: {
          may: [],
          not: ['replant the north beds before the soil report is in'],
          never: [],
          scope: null,
          reading: 'covers nothing yet',
          where: 'chat',
          set: '2026-03-03T09:00:00Z',
        },
      }),
    }),
  );

  expect(
    brief.split('\n').filter((line) => /^(?:GRANT|  (?:may|not|never|reading))/u.test(line)),
  ).toStrictEqual([
    'GRANT  from the owner in chat, 7d ago',
    '  not    • replant the north beds before the soil report is in',
    '  reading: covers nothing yet',
  ]);
});

test('it prints two short never bullets of a grant of only never bullets on one line', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      host: 'codex',
      session: buildMockSession({
        grant: {
          may: [],
          not: [],
          never: ['dig up the roses', 'spray the hives'],
          scope: null,
          reading: 'covers nothing yet',
          where: 'chat',
          set: '2026-03-03T09:00:00Z',
        },
      }),
    }),
  );

  expect(brief.split('\n').filter((line) => line.startsWith('  never'))).toStrictEqual([
    '  never  • dig up the roses  • spray the hives',
  ]);
});

test('it orders the tasks as the day-9 example does: focus, changed, blocked and owed, then newest', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      host: 'claude',
      items: buildMockIDs('task', 20).map((id) => buildMockItem({ id })),
    }),
  );

  expect({
    heading: brief.includes('OPEN (20, max 30)\n'),
    rows: brief.split('\n').filter((line) => line.startsWith('  task')).length,
    hasCountLine: brief.includes('more open tasks'),
  }).toStrictEqual({ heading: true, rows: 20, hasCountLine: false });
});

test('it prints the changed overflow line that names the list of open tasks', () => {
  const ctx = setupTest();

  const brief = ctx.render(
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

test.each([
  {
    title: 'a change after the step was set',
    nowHidden: { kind: 'changed' },
    line: '  next step hidden: pr-api-77 changed after it was set. Run: www now pr-api-77 "<next step>"',
  },
  {
    title: 'a result of MERGED with no change',
    nowHidden: { kind: 'reads', result: 'MERGED' },
    line: '  next step hidden: pr-api-77 reads MERGED. Run: www now pr-api-77 "<next step>"',
  },
] as const)(
  'it prints the hidden line for $title in place of the next step, with the note whole under it',
  (row) => {
    const ctx = setupTest();
    const note = buildMockNote({ id: 'pr-api-77', note: 'Wait for the owner to merge' });

    const brief = ctx.render(
      buildMockBriefInput({
        session: buildMockSession({
          now: 'pr-api-77',
          nowNext: 'request review',
          nowSet: '2026-03-10T10:31:09Z',
        }),
        items: [buildMockItem({ id: 'pr-api-77', check: 'pr:bosunhq/bosun-api#77' })],
        notes: [note],
        nowHidden: row.nowHidden,
      }),
    );

    const lines = brief.split('\n');
    const start = lines.findIndex((line) => line.startsWith('NOW'));

    expect(lines.slice(start, start + 3)).toStrictEqual([
      'NOW  pr-api-77 · set 1h ago · note 1h ago',
      row.line,
      '    Wait for the owner to merge',
    ]);
  },
);

test('it prints no hidden line when no next step is set, and none of its text', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      session: buildMockSession({ now: 'pr-api-77', nowNext: null, nowSet: null }),
      items: [buildMockItem({ id: 'pr-api-77', check: 'pr:bosunhq/bosun-api#77' })],
      nowHidden: { kind: 'changed' },
    }),
  );

  expect([brief.includes('next step hidden'), brief.includes('  next: ')]).toStrictEqual([
    false,
    false,
  ]);
});

test('it tags the row of an item whose probe read unchecked as unchecked, and keeps the saved result for the changed row', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 't-a', check: 'pid:42', atWrite: 'alive', last: 'gone' }),
        buildMockItem({ id: 'w-a', kind: 'wait', check: 'pid:43', extra: { who: 'owner' } }),
        buildMockItem({ id: 'wt-a', kind: 'where', check: 'path:/srv/app', last: 'clean' }),
      ],
      results: new Map([
        ['t-a', 'unchecked'],
        ['w-a', 'unchecked'],
        ['wt-a', 'unchecked'],
      ]),
    }),
  );

  expect([
    brief.includes('  t-a         Write the parser  [unchecked]\n'),
    brief.includes('  w-a         Write the parser  [owner · unchecked]\n'),
    brief.includes('  wt-a        Write the parser  [unchecked]\n'),
  ]).toStrictEqual([true, true, true]);
});

test("it tags each row from this read's result before the saved one", () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      items: [buildMockItem({ id: 't-a', check: 'pid:42', last: 'alive' })],
      results: new Map([['t-a', 'gone']]),
    }),
  );

  expect(brief).toInclude('  t-a         Write the parser  [gone]\n');
});

test.each([
  {
    title: 'owner words',
    expected:
      '  w-plain     "Plain words in every reply; I would rather read three short sentences than one clever one"  [chat · 6d]',
    input: {
      words: [
        {
          id: 'w-plain',
          words:
            'Plain words in every reply; I would rather read three short sentences than one clever one',
          where: 'chat',
          written: '2026-03-04T11:43:00Z',
          by: 'owner' as const,
        },
      ],
    },
  },
  {
    title: 'a promise',
    expected:
      '  due-cost    Cost table for the alert fan-out  [to owner · by day 10, before review]',
    input: {
      promises: [
        {
          id: 'due-cost',
          what: 'Cost table for the alert fan-out',
          to: 'owner',
          byWhen: 'day 10, before review',
          written: '2026-03-09T10:43:00Z',
          by: 'agent' as const,
        },
      ],
    },
  },
  {
    title: 'a lesson',
    expected:
      '  l-seed      Reseed the staging alerts table before alerts-e2e  [why: A stale row made alerts-e2e pass on day 6 while no alert fired]',
    input: {
      lessons: [
        {
          id: 'l-seed',
          text: 'Reseed the staging alerts table before alerts-e2e',
          why: 'A stale row made alerts-e2e pass on day 6 while no alert fired',
          written: '2026-03-04T11:43:00Z',
          by: 'agent' as const,
        },
      ],
    },
  },
])('it renders the row of $title as the day-9 brief does', (row) => {
  const ctx = setupTest();
  const brief = ctx.render(buildMockBriefInput(row.input));

  expect(brief.split('\n')).toContain(row.expected);
});

test('it prints the headings of the new sections with their caps, in the order of the brief', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      words: [
        {
          id: 'w-a',
          words: 'Be brief',
          where: 'chat',
          written: '2026-03-04T11:43:00Z',
          by: 'owner',
        },
      ],
      promises: [
        {
          id: 'due-a',
          what: 'Ship it',
          to: 'owner',
          byWhen: 'Friday',
          written: '2026-03-04T11:43:00Z',
          by: 'agent',
        },
      ],
      lessons: [
        {
          id: 'l-a',
          text: 'Reseed',
          why: 'It broke',
          written: '2026-03-04T11:43:00Z',
          by: 'agent',
        },
      ],
      decisions: [{ id: 'd-2', choice: 'Use the feed' }],
      items: [
        buildMockItem({ id: 'w-b', kind: 'wait', extra: { who: 'owner' } }),
        buildMockItem({ id: 'r-a', kind: 'rule' }),
        buildMockItem({ id: 'wh-a', kind: 'where' }),
      ],
    }),
  );

  expect(
    brief.split('\n').filter((line) => /^[A-Z]/u.test(line) && !line.startsWith('GRANT')),
  ).toStrictEqual([
    expect.stringMatching(/^GOAL/u),
    'WORDS (1, max 8)',
    'NOW  none. Run: www now <id> "<next step>"',
    'WAITING (1, max 8)',
    'PROMISED (1, max 5)',
    'RULES (1, max 15)',
    'LESSONS (1, max 5)',
    'DECISIONS (1 in force)',
    'WHERE (1, max 8)',
    expect.stringMatching(/^Write as you go/u),
  ]);
});

test('it prints the 3 newest decisions in force and a count line for the rest', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      decisions: ['d-23', 'd-21', 'd-20', 'd-19', 'd-12', 'd-7'].map((id) => ({
        id,
        choice: `Choice ${id}`,
      })),
    }),
  );

  expect(brief.split('\n').slice(4, 9)).toStrictEqual([
    'DECISIONS (6 in force)',
    '  d-23  Choice d-23',
    '  d-21  Choice d-21',
    '  d-20  Choice d-20',
    '  and 3 more: www list decisions',
  ]);
});

test('it cuts a decision of 300 characters to 199 and an ellipsis', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({ decisions: [{ id: 'd-1', choice: 'c'.repeat(300) }] }),
  );

  expect(brief).toInclude(`  d-1  ${'c'.repeat(199)}…\n`);
});

test('it drops the rows one at a time in the cut order, each from the end of its section', () => {
  const ctx = setupTest();
  const store = buildCutOrderStore();
  const full = ctx.render(store.input);
  const violations: number[] = [];

  const droppedCounts = new Set<number>();

  for (let limit = Buffer.byteLength(full); limit >= 0; limit -= 1) {
    const brief = ctx.render(store.input, limit);
    const dropped = store.order.filter((mark) => !hasBriefRow(brief, mark));

    droppedCounts.add(dropped.length);

    if (JSON.stringify(dropped) !== JSON.stringify(store.order.slice(0, dropped.length))) {
      violations.push(limit);
    }
  }

  expect({ violations, reachesLast: droppedCounts.has(store.order.length) }).toStrictEqual({
    violations: [],
    reachesLast: true,
  });
});

test('it keeps the item in focus and its count line when the cut takes every other task row', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      session: buildMockSession({ now: 't-b' }),
      items: ['t-a', 't-b', 't-c', 't-d'].map((id) => buildMockItem({ id })),
      notes: [buildMockNote({ id: 't-b', note: 'Keep this note whole' })],
    }),
    1,
  );

  const lines = brief.split('\n');
  const openAt = lines.indexOf('OPEN (4, max 30)');

  expect(lines.slice(openAt, openAt + 3)).toStrictEqual([
    'OPEN (4, max 30)',
    '  t-b         Write the parser  [no check · 1h]',
    '  and 3 more open tasks: www show',
  ]);

  expect(brief).toInclude('    Keep this note whole\n');
});

test('it leaves OPEN out when no task is in focus and no task exists, and keeps its heading and count line when every task row is cut', () => {
  const ctx = setupTest();

  const input = buildMockBriefInput({
    session: buildMockSession({ now: null, nowNext: null, nowSet: null }),
    items: ['t-a', 't-b'].map((id) => buildMockItem({ id })),
  });

  expect(ctx.render(input, 1).split('\n')).toContain('  and 2 more open tasks: www show');
});

test('it keeps the row of a wait in focus, with its note, while the waits are cut', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      session: buildMockSession({ now: 'w-a' }),
      items: [
        buildMockItem({ id: 'w-a', kind: 'wait', extra: { who: 'owner' } }),
        buildMockItem({ id: 'w-b', kind: 'wait', extra: { who: 'owner' } }),
      ],
      notes: [buildMockNote({ id: 'w-a', note: 'Keep this note whole' })],
    }),
    1,
  );

  expect(
    brief.split('\n').filter((line) => line.startsWith('  w-') || line.startsWith('  and')),
  ).toStrictEqual(['  w-a         Write the parser  [owner · 1h]', '  and 1 more: www list waits']);
});

test('it keeps a wait on the owner while every wait on someone else is cut, and the cut line counts only the cut ones', () => {
  const ctx = setupTest();

  const waits = [
    buildMockItem({ id: 'w-own1', kind: 'wait', claim: 'Owner one', extra: { who: 'owner' } }),
    buildMockItem({ id: 'w-own2', kind: 'wait', claim: 'Owner two', extra: { who: 'owner' } }),
    buildMockItem({ id: 'w-oth1', kind: 'wait', claim: 'Other one', extra: { who: 'vendor' } }),
    buildMockItem({ id: 'w-oth2', kind: 'wait', claim: 'Other two', extra: { who: 'vendor' } }),
    buildMockItem({ id: 'w-oth3', kind: 'wait', claim: 'Other three', extra: { who: 'vendor' } }),
  ];

  const input = buildMockBriefInput({ session: buildMockSession({ now: null }), items: waits });
  const full = ctx.render(input);

  const otherBytes = full
    .split('\n')
    .filter((line) => line.startsWith('  w-oth'))
    .reduce((sum, line) => sum + Buffer.byteLength(line) + 1, 0);

  const cutLineBytes = Buffer.byteLength('  and 3 more: www list waits\n');
  const brief = ctx.render(input, Buffer.byteLength(full) - otherBytes + cutLineBytes);

  expect(
    brief.split('\n').filter((line) => line.startsWith('  w-') || line.startsWith('  and')),
  ).toStrictEqual([
    expect.stringMatching(/^ {2}w-own1 /u),
    expect.stringMatching(/^ {2}w-own2 /u),
    '  and 3 more: www list waits',
  ]);
});

test('it keeps the heading and the cut line of a section that loses every row', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({ items: [buildMockItem({ id: 'r-a', kind: 'rule' })] }),
    1,
  );

  expect(brief).toInclude('RULES (1, max 15)\n  and 1 more: www list rules\n');
});

test.each([
  { sessionFlag: null, rules: 'www list rules', prs: 'www list prs' },
  {
    sessionFlag: 'tide-alerts',
    rules: 'www --session tide-alerts list rules',
    prs: 'www --session tide-alerts list prs',
  },
])('it ends the cut sections with their list command for the session flag $sessionFlag', (row) => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      sessionFlag: row.sessionFlag,
      items: [buildMockItem({ id: 'r-a', kind: 'rule' })],
      pullRequests: ['acme/tool#1', 'acme/tool#2', 'acme/tool#3'].map((ref) => ({
        ref,
        opened: '2026-03-10T08:43:00Z',
        result: 'OPEN',
      })),
    }),
    1,
  );

  expect(brief.split('\n').filter((line) => line.startsWith('  and '))).toStrictEqual([
    `  and 1 more: ${row.rules}`,
    `  and 3 more: ${row.prs}`,
  ]);
});

test('it keeps the overflow line of the pull request section, counting every pull request, when the cut drops its row and hint', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    buildMockBriefInput({
      pullRequests: ['acme/tool#1', 'acme/tool#2'].map((ref) => ({
        ref,
        opened: '2026-03-10T08:43:00Z',
        result: 'OPEN',
      })),
    }),
    1,
  );

  expect(brief).toInclude(
    'PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (2)\n  and 2 more: www list prs\nWrite as you go',
  );
});

test('it ends DECISIONS with its count line and then its cut line, when 6 are in force and 2 of its 3 rows are cut', () => {
  const ctx = setupTest();

  const input = buildMockBriefInput({
    decisions: ['d-6', 'd-5', 'd-4', 'd-3', 'd-2', 'd-1'].map((id) => ({
      id,
      choice: `Choice number ${id}`,
    })),
  });

  const full = ctx.render(input);

  const rowBytes = ['  d-5  Choice number d-5\n', '  d-4  Choice number d-4\n'].map((line) =>
    Buffer.byteLength(line),
  );

  const cutLineBytes = Buffer.byteLength('  and 2 more: www list decisions\n');

  const brief = ctx.render(
    input,
    Buffer.byteLength(full) - (rowBytes[0] ?? 0) - (rowBytes[1] ?? 0) + cutLineBytes,
  );

  expect(brief).toInclude(
    'DECISIONS (6 in force)\n  d-6  Choice number d-6\n  and 3 more: www list decisions\n  and 2 more: www list decisions\n',
  );
});

test('it drops the open row of a changed task like any task row, and keeps its changed row', () => {
  const ctx = setupTest();
  const changed = buildMockItem({ id: 't-chg', check: 'pid:4', atWrite: 'alive' });

  const brief = ctx.render(
    buildMockBriefInput({
      session: buildMockSession({ now: null, nowNext: null, nowSet: null }),
      items: [changed],
      changed: [{ item: changed, result: 'gone' }],
    }),
    1,
  );

  expect(brief.split('\n').filter((line) => line.startsWith('  t-chg'))).toStrictEqual([
    expect.stringContaining('was alive (1h) · now gone'),
  ]);
});

test('it prints the never-cut lines whole when they alone pass the limit, over a limit of 100 bytes', () => {
  const ctx = setupTest();

  const brief = ctx.render(
    {
      ...buildWorstCaseBriefInput({ host: 'claude', taskCount: 30 }),
      nowHidden: { kind: 'changed' },
    },
    100,
  );

  const lines = brief.split('\n');
  const focus = buildMockIDs('task', 1)[0] ?? '';

  expect({
    header: lines[0]?.includes(' · day '),
    goal: lines.some((line) => line.startsWith('GOAL  ')),
    grant: lines.some((line) => line.startsWith('GRANT  from the owner')),
    ownerNotes: lines.some((line) => line.startsWith('OWNER SAYS (2)')),
    changedOverflow: lines.some((line) => line.startsWith('  and 7 more;')),
    now: lines.some((line) => line.startsWith('NOW  ')),
    hidden: lines.some((line) => line.startsWith('  next step hidden:')),
    focusRow: lines.some((line) => line.startsWith(`  ${focus}`)),
    footer: lines.at(-2) === briefFooter,
    rows: lines.filter((line) =>
      /^ {2}(?:word|prom|less|rule|appr|here|wait|d-|task0[2-9])/u.test(line),
    ),
    isOver: Buffer.byteLength(brief) > 100,
  }).toStrictEqual({
    header: true,
    goal: true,
    grant: true,
    ownerNotes: true,
    changedOverflow: true,
    now: true,
    hidden: true,
    focusRow: true,
    footer: true,
    rows: [],
    isOver: true,
  });
});

test.each([
  { host: 'claude', limit: 24_000 },
  { host: 'codex', limit: 30_000 },
  { host: null, limit: 60_000 },
] as const)(
  'it renders the ASCII worst case of brief.md within the limit of $host and cuts nothing',
  (row) => {
    const ctx = setupTest();
    const doc = ctx.readDoc();
    const whole = buildWorstCaseBriefInput({ host: row.host, taskCount: 30 });

    const inputs = [
      whole,
      buildWorstCaseBriefInput({ host: row.host, taskCount: 30, nowHidden: { kind: 'changed' } }),
      buildWorstCaseBriefInput({ host: row.host, taskCount: 30, results: 'unchecked' }),
    ];

    const briefs = inputs.map((input) => ctx.render(input));
    const blocks = collectBriefBlocks(briefs[0] ?? '');

    expect({
      labels: blocks.map((block, index) => doc.blocks[index]?.label.startsWith(block.label)),
      bytes: blocks.map((block) => block.bytes),
      total: Buffer.byteLength(briefs[0] ?? ''),
      missing: inputs.map((input, index) => collectMissingRows(input, briefs[index] ?? '')),
      fits: briefs.map((brief) => Buffer.byteLength(brief) <= row.limit),
      listLines: collectBriefRows(briefs[0] ?? '', /^ {2}and \d+ more: www list /u),
    }).toStrictEqual({
      labels: blocks.map(() => true),
      bytes: doc.blocks.map((block) => block.bytes),
      total: doc.totalBytes,
      missing: [[], [], []],
      fits: [true, true, true],
      listLines: ['  and 3 more: www list decisions', '  and 9 more: www list prs'],
    });
  },
);

test.each(['claude', 'codex', null] as const)(
  'it cuts the 3-byte worst case for %p in the cut order, and each cut line counts what it cut',
  (host) => {
    const ctx = setupTest();
    const brief = ctx.render(buildThreeByteCutInput(host));
    const limit = { claude: 24_000, codex: 30_000, none: 60_000 }[host ?? 'none'];
    const lines = brief.split('\n');

    const rowsOf = (rank: CutRank): string[] =>
      lines.filter(
        (line) => threeByteRanks[rank].prefix.test(line) && !line.startsWith('  task01'),
      );

    const lost = (rank: CutRank): number => threeByteRanks[rank].cap - rowsOf(rank).length;
    const stoppedAt = cutRanks.findIndex((rank) => rowsOf(rank).length > 0);

    // a rank before the stop has no row, the stop lost rows from its end, a later rank is whole
    const wrongRanks = cutRanks.filter((rank, index) => {
      if (index < stoppedAt) {
        return lost(rank) !== threeByteRanks[rank].cap;
      }

      return index === stoppedAt ? lost(rank) < 0 : lost(rank) !== 0;
    });

    const gaps = cutRanks.filter((rank) => {
      const numbers = rowsOf(rank).map((line) => Number(/(?<digits>\d+)/u.exec(line)?.[1]));

      return (
        rank !== 'tasks' &&
        rank !== 'pull-requests' &&
        numbers.some((number, index) => number !== (rank === 'decisions' ? 99 - index : index + 1))
      );
    });

    const cutLineCounts = Object.fromEntries(
      cutRanks
        .filter((rank) => threeByteSections[rank].kind !== null)
        .map((rank) => [
          rank,
          lines.filter(
            (line) =>
              line ===
              `  and ${String(lost(rank))} more: www list ${threeByteSections[rank].kind ?? ''}`,
          ).length,
        ]),
    );

    expect({
      isWithinLimit: Buffer.byteLength(brief) <= limit,
      wrongRanks,
      gaps,
      neverCut: [
        lines[0]?.includes(' · day '),
        lines.some((line) => line.startsWith('GOAL  ')),
        lines.some((line) => line.startsWith('GRANT  from the owner')),
        lines.some((line) => line.startsWith('OWNER SAYS (2)')),
        lines.some((line) => line.startsWith('CHANGED SINCE WRITTEN (10)')),
        lines.some((line) => line.startsWith('  and 7 more;')),
        lines.some((line) => line.startsWith('NOW  task01xxxxxxxxxx')),
        lines.some((line) => line.startsWith('  next step hidden:')),
        lines.some((line) => line.startsWith('  task01xxxxxxxxxx')),
        lines.at(-2) === briefFooter,
      ].every(Boolean),
      openCountLine: lines.filter((line) => line.includes('more open tasks: www show')),
      pullRequestLine: lines.filter((line) => line.includes('more: www list prs')),
      cutLineCounts,
    }).toStrictEqual({
      isWithinLimit: true,
      wrongRanks: [],
      gaps: [],
      neverCut: true,
      openCountLine:
        lost('tasks') === 0 ? [] : [`  and ${String(lost('tasks'))} more open tasks: www show`],
      pullRequestLine: [`  and ${String(10 - rowsOf('pull-requests').length)} more: www list prs`],

      // DECISIONS also ends with its count line, the same text when the cut takes all 3
      cutLineCounts: Object.fromEntries(
        cutRanks
          .filter((rank) => threeByteSections[rank].kind !== null)
          .map((rank) => [
            rank,
            lost(rank) === 0 ? 0 : 1 + Number(lost(rank) === 3 && rank === 'decisions'),
          ]),
      ),
    });
  },
);

test('it holds the never-cut lines at their widest under 9,000 bytes, and under 17,000 with the owner words', () => {
  const ctx = setupTest();
  const input = buildNeverCutInput(null);

  // the words are the last rank the cut reaches, so the smallest limit that keeps all 8 leaves
  // every other row cut
  let low = 0;
  let high = 60_000;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (collectBriefRows(ctx.render(input, middle), /^ {2}word\d\d/u).length === 8) {
      high = middle;
    } else {
      low = middle + 1;
    }
  }

  const neverCut = ctx.render(input, 1);
  const withWords = ctx.render(input, low);

  expect({
    neverCutBytes: Buffer.byteLength(neverCut) < 9000,
    withWordsBytes: Buffer.byteLength(withWords) < 17_000,
    focus: neverCut.split('\n').filter((line) => line.startsWith('NOW  wait01')),
    cutLines: neverCut
      .split('\n')
      .filter((line) => line.includes(' --session nnnnnnnnnnnnnnnnnnnnnnnn list ')),
    otherRows: withWords
      .split('\n')
      .filter((line) => /^ {2}(?:prom|here|d-|less|rule|appr|p{60})/u.test(line)),
  }).toStrictEqual({
    neverCutBytes: true,
    withWordsBytes: true,
    focus: ['NOW  wait01xxxxxxxxxx · set 990d ago · owed note 990d ago'],
    cutLines: [
      ['8', 'words'],
      ['7', 'waits'],
      ['5', 'promises'],
      ['1', 'approvals'],
      ['15', 'rules'],
      ['5', 'lessons'],
      ['3', 'decisions'],
      ['3', 'decisions'],
      ['8', 'where'],
      ['10', 'prs'],
    ].map(([count, kind]) => `  and ${count} more: www --session ${'n'.repeat(24)} list ${kind}`),
    otherRows: [],
  });
});

test('it starts the header with the session name and day, and ends with the footer, for every store', () => {
  const ctx = setupTest();
  const cutStore = buildCutOrderStore();

  const briefs = [
    ctx.render(buildMockBriefInput({})),
    ctx.render(cutStore.input),
    ctx.render(cutStore.input, 1),
    ...(['claude', 'codex', null] as const).flatMap((host) => [
      ctx.render(buildWorstCaseBriefInput({ host, taskCount: 30 })),
      ctx.render(buildWorstCaseBriefInput({ host, taskCount: 30, nowHidden: { kind: 'changed' } })),
      ctx.render(buildWorstCaseBriefInput({ host, taskCount: 30, results: 'unchecked' })),
      ctx.render(buildWorstCaseBriefInput({ host, taskCount: 30 }), 1),
      ctx.render(buildThreeByteCutInput(host)),
      ctx.render(buildThreeByteCutInput(host), 1),
      ctx.render(buildThreeByteCutInput(host), 100),
      ctx.render(buildNeverCutInput(host)),
      ctx.render(buildNeverCutInput(host), 1),
    ]),
  ];

  expect(
    briefs.map((brief) => [
      /^[a-z0-9-]+ · day \d+ · /u.test(brief),
      brief.endsWith(`${briefFooter}\n`),
      sortBriefEnd(
        {
          event: 'PostToolUse',
          harness: 'claude',
          sessionID: '9e1f-trial',
          agentID: null,
          toolName: 'Bash',
          command: 'www',
          response: brief,
          exitCode: null,
          maxOutputTokens: null,
        },
        brief.split(' · day')[0] ?? '',
      ),
    ]),
  ).toStrictEqual(briefs.map(() => [true, true, 'whole']));
});

test('it prints a credential in a stored decision as the placeholder, when the cut would split it', () => {
  const ctx = setupTest();
  const sample = buildCredentialSamples()[0]?.sample ?? '';
  const choice = `${'c'.repeat(190)} ${sample} ${'d'.repeat(50)}`;
  const brief = ctx.render(buildMockBriefInput({ decisions: [{ id: 'd-1', choice }] }));

  expect({
    hasSample: brief.includes(sample.slice(0, 8)),
    hasPlaceholder: brief.includes('<where the secret lives>'),
  }).toStrictEqual({ hasSample: false, hasPlaceholder: true });
});

test.each(buildCredentialSamples().map((entry) => [entry.name, entry.sample] as const))(
  'it prints a --session name that is a %s credential as the placeholder in each cut and count line',
  (_name, sample) => {
    const ctx = setupTest();
    const brief = ctx.render({ ...buildThreeByteCutInput('claude'), sessionFlag: sample });
    const countLines = collectBriefRows(brief, /^ {2}and \d+ more(?: open tasks)?: www /u);

    expect({
      leaked: brief.includes(sample.slice(0, 8)),
      hasCountLines: countLines.length > 0,
      unredacted: countLines.filter((line) => !line.includes('<where the secret lives>')),
    }).toStrictEqual({ leaked: false, hasCountLines: true, unredacted: [] });
  },
);

test('it gives renderBrief a limit in no file but its tests', () => {
  const ctx = setupTest();
  const packageDir = ctx.packageDir;

  const callers = listTypeScriptFiles(packageDir, ['src'])
    .filter((file) => !file.endsWith('.test.ts'))
    .filter((file) =>
      hasSecondArgument(readFileSync(join(packageDir, file), 'utf8'), 'renderBrief'),
    );

  expect(callers).toStrictEqual([]);
});
