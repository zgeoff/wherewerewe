import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockNote } from '../test-utils/build-mock-note.ts';
import { renderList } from './render-list.ts';

test('it lists every wait under its heading with its count and cap, a note under its row', () => {
  const text = renderList(
    'waits',
    buildMockBriefInput({
      items: [
        buildMockItem({
          id: 'w-apns',
          kind: 'wait',
          claim: 'upload the staging push key to the vault',
          extra: { who: 'owner' },
          written: '2026-03-08T11:43:00Z',
        }),
        buildMockItem({ id: 't-a', claim: 'A task' }),
      ],
      notes: [buildMockNote({ id: 'w-apns', note: 'Ask in the infra channel' })],
    }),
  );

  expect(text).toStrictEqual(
    [
      'WAITING (1, max 8)',
      '  w-apns      upload the staging push key to the vault  [owner · 2d]',
      '    note (1h): Ask in the infra channel',
      '',
    ].join('\n'),
  );
});

test.each([
  { kind: 'waits', heading: 'WAITING (0, max 8)\n' },
  { kind: 'approvals', heading: 'APPROVED ONCE (0, max 1)\n' },
  { kind: 'rules', heading: 'RULES (0, max 15)\n' },
  { kind: 'where', heading: 'WHERE (0, max 8)\n' },
  { kind: 'lessons', heading: 'LESSONS (0, max 5)\n' },
  { kind: 'promises', heading: 'PROMISED (0, max 5)\n' },
  { kind: 'words', heading: 'WORDS (0, max 8)\n' },
  { kind: 'tasks', heading: 'OPEN (0, max 30)\n' },
  { kind: 'decisions', heading: 'DECISIONS (0 in force)\n' },
  { kind: 'prs', heading: 'PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (0)\n' },
  { kind: 'notes', heading: '' },
] as const)('it prints $kind with no row as its heading alone', (row) => {
  expect(renderList(row.kind, buildMockBriefInput({}))).toBe(row.heading);
});

test('it lists the lessons, promises and words with the tags the brief prints', () => {
  const input = buildMockBriefInput({
    lessons: [
      {
        id: 'l-seed',
        text: 'Reseed the staging alerts table before alerts-e2e',
        why: 'A stale row made alerts-e2e pass',
        written: '2026-03-04T09:00:00Z',
        by: 'agent',
      },
    ],
    promises: [
      {
        id: 'due-cost',
        what: 'Cost table for the alert fan-out',
        to: 'owner',
        byWhen: 'day 10, before review',
        written: '2026-03-04T09:00:00Z',
        by: 'agent',
      },
    ],
    words: [
      {
        id: 'w-plain',
        words: 'Plain words in every reply',
        where: 'chat',
        written: '2026-03-04T11:43:00Z',
        by: 'owner',
      },
    ],
  });

  expect([
    renderList('lessons', input),
    renderList('promises', input),
    renderList('words', input),
  ]).toStrictEqual([
    'LESSONS (1, max 5)\n  l-seed      Reseed the staging alerts table before alerts-e2e  [why: A stale row made alerts-e2e pass]\n',
    'PROMISED (1, max 5)\n  due-cost    Cost table for the alert fan-out  [to owner · by day 10, before review]\n',
    'WORDS (1, max 8)\n  w-plain     "Plain words in every reply"  [chat · 6d]\n',
  ]);
});

test('it lists a decision whole, newest first, with no 200-character cut', () => {
  const choice = 'c'.repeat(300);

  const text = renderList(
    'decisions',
    buildMockBriefInput({
      decisions: [
        { id: 'd-23', choice },
        { id: 'd-7', choice: 'Read tide times in UTC' },
      ],
    }),
  );

  expect(text).toStrictEqual(
    `DECISIONS (2 in force)\n  d-23  ${choice}\n  d-7  Read tide times in UTC\n`,
  );
});

test('it lists every open pull request no item names, with its saved state and no hint', () => {
  const text = renderList(
    'prs',
    buildMockBriefInput({
      pullRequests: [
        { ref: 'acme/app#64', opened: '2026-03-10T08:43:00Z', result: 'OPEN pending' },
        { ref: 'acme/app#65', opened: '2026-03-10T09:43:00Z', result: 'OPEN failing' },
      ],
    }),
  );

  expect(text).toStrictEqual(
    [
      'PULL REQUESTS THIS SESSION OPENED THAT NO ITEM NAMES (2)',
      '  acme/app#64  opened 3h ago  [OPEN pending]',
      '  acme/app#65  opened 2h ago  [OPEN failing]',
      '',
    ].join('\n'),
  );
});

test('it lists the notes owed first, then newest, as item lines with no tag and no heading', () => {
  const text = renderList(
    'notes',
    buildMockBriefInput({
      items: [
        buildMockItem({ id: 't-old', claim: 'Old task' }),
        buildMockItem({ id: 't-new', claim: 'New task' }),
        buildMockItem({ id: 't-owed', claim: 'Owed task' }),
      ],
      notes: [
        buildMockNote({ id: 't-old', note: 'Older', written: '2026-03-10T08:43:00Z' }),
        buildMockNote({ id: 't-new', note: 'Newer', written: '2026-03-10T10:43:00Z' }),
        buildMockNote({
          id: 't-owed',
          note: 'Owed',
          owed: true,
          written: '2026-03-09T10:43:00Z',
        }),
      ],
    }),
  );

  expect(text.split('\n')).toStrictEqual([
    '  t-owed      Owed task',
    '    owed note (25h): Owed',
    '  t-new       New task',
    '    note (1h): Newer',
    '  t-old       Old task',
    '    note (3h): Older',
    '',
  ]);
});

test('it wraps a note of 120 characters at 85 to 100 columns under its row', () => {
  const note = `${'word '.repeat(23)}end`;

  const lines = renderList(
    'where',
    buildMockBriefInput({
      items: [buildMockItem({ id: 'wh-a', kind: 'where', claim: 'A worktree' })],
      notes: [buildMockNote({ id: 'wh-a', note })],
    }),
  )
    .trimEnd()
    .split('\n');

  expect(lines.slice(2).map((line) => line.length <= 100)).toStrictEqual([true, true]);
});

test('it prints a credential in a stored note as the placeholder, not split by the wrap', () => {
  const sample = buildCredentialSamples()[0]?.sample ?? '';
  const note = `${'a '.repeat(40)}${sample} tail`;

  const text = renderList(
    'rules',
    buildMockBriefInput({
      items: [buildMockItem({ id: 'r-a', kind: 'rule', claim: 'A rule' })],
      notes: [buildMockNote({ id: 'r-a', note })],
    }),
  );

  expect([
    text.includes(sample.slice(0, 8)),
    text.includes('<where the secret lives>'),
  ]).toStrictEqual([false, true]);
});

test('it lists every task of a store of 30, whole, with the ids in order', () => {
  const ids = buildMockIDs('task', 30);

  const text = renderList(
    'tasks',
    buildMockBriefInput({ items: ids.map((id) => buildMockItem({ id })) }),
  );

  expect(text.split('\n').length).toBe(32);
});

test('it attaches no note to a lesson whose id an item with a note also holds', () => {
  const input = buildMockBriefInput({
    items: [buildMockItem({ id: 'l-seed', claim: 'A task of the same id' })],
    notes: [buildMockNote({ id: 'l-seed', note: 'The task keeps this note' })],
    lessons: [
      {
        id: 'l-seed',
        text: 'Reseed the staging alerts table before alerts-e2e',
        why: 'A stale row made alerts-e2e pass',
        written: '2026-03-04T09:00:00Z',
        by: 'agent',
      },
    ],
  });

  expect(renderList('lessons', input)).toBe(
    'LESSONS (1, max 5)\n  l-seed      Reseed the staging alerts table before alerts-e2e  [why: A stale row made alerts-e2e pass]\n',
  );
});
