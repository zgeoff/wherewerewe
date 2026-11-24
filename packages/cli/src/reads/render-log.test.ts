import { expect, test } from 'bun:test';
import type { JournalRow } from '../types.ts';
import { renderLog } from './render-log.ts';

test("it prints commands.md's log example, character for character", () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'decide',
      id: 'd-23',
      by: 'agent',
      text: 'Retry a 503 from the tide feed 3 times, 2 s apart',
      why: 'The feed returns 503 for about 4 s during its hourly refresh',
      extra: 'on=pr-api-77;who=agent',
    },
    {
      ts: '2026-03-10T11:51:02Z',
      op: 'done',
      id: 'pr-app-61',
      by: 'agent',
      text: 'Alert settings screen: in review',
      why: 'merged as 51aa0e2, seen by check',
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 9  10:48  decide    d-23       agent  Retry a 503 from the tide feed 3 times, 2 s apart',
      '                                          why: The feed returns 503 for about 4 s during its hourly refresh',
      'day 9  11:51  done      pr-app-61  agent  Alert settings screen: in review',
      '                                          why: merged as 51aa0e2, seen by check',
      '',
    ].join('\n'),
  );
});

test('it pads the day to the widest day past day 9', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'task',
      id: 't-a',
      by: 'agent',
      text: 'x',
      why: null,
      extra: null,
    },
    {
      ts: '2026-03-11T09:05:00Z',
      op: 'task',
      id: 't-b',
      by: 'agent',
      text: 'y',
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 9   10:48  task      t-a        agent  x',
      'day 10  09:05  task      t-b        agent  y',
      '',
    ].join('\n'),
  );
});

test('it shows the who= of a decision, and the author of any other row', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'decide',
      id: 'd-1',
      by: 'agent',
      text: 'a',
      why: 'b',
      extra: 'who=owner',
    },
    {
      ts: '2026-03-03T10:01:00Z',
      op: 'ruled-out',
      id: 'd-2',
      by: 'agent',
      text: 'c',
      why: 'd',
      extra: 'on=t-a;who=agent',
    },
    {
      ts: '2026-03-03T10:02:00Z',
      op: 'changed',
      id: 'pr-a',
      by: 'hook',
      text: 'x -> y',
      why: null,
      extra: 'who=owner',
    },
  ];

  const lines = renderLog(rows, '2026-03-02T08:04:11Z').split('\n');

  expect(lines.filter((line) => !line.includes('why:'))).toStrictEqual([
    'day 2  10:00  decide    d-1        owner  a',
    'day 2  10:01  ruled-out d-2        agent  c',
    'day 2  10:02  changed   pr-a       hook   x -> y',
    '',
  ]);
});

test('it gives an id of 11 characters or more one space, and puts the why under its own text', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'task',
      id: 'pr-api-77-ab',
      by: 'agent',
      text: 'x',
      why: 'because',
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 2  10:00  task      pr-api-77-ab agent  x',
      '                                            why: because',
      '',
    ].join('\n'),
  );
});

test('it prints a row with no text as the columns alone', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'ack',
      id: 'o-1',
      by: 'owner',
      text: null,
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    'day 2  10:00  ack       o-1        owner\n',
  );
});

test('it keeps one space after an op longer than the op column', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'historical',
      id: 'opt-a',
      by: 'import',
      text: 'picked a',
      why: null,
      extra: null,
    },
    {
      ts: '2026-03-03T10:05:00Z',
      op: 'task',
      id: 't-b',
      by: 'agent',
      text: 'x',
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 2  10:00  historical opt-a      import picked a',
      'day 2  10:05  task       t-b        agent  x',
      '',
    ].join('\n'),
  );
});

test('it keeps one space after a who longer than the who column', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'decide',
      id: 'd-1',
      by: 'agent',
      text: 'x',
      why: null,
      extra: 'who=migration',
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    'day 2  10:00  decide    d-1        migration x\n',
  );
});

test('it prints the trailing spaces of a stored text as stored', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'task',
      id: 't-a',
      by: 'agent',
      text: 'spaced   ',
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    'day 2  10:00  task      t-a        agent  spaced   \n',
  );
});

test('it says when no row is left', () => {
  expect(renderLog([], '2026-03-02T08:04:11Z')).toBe('No journal rows match.\n');
});

test('it prints rows oldest first when the journal holds a newer row before an older one', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-04T10:00:00Z',
      op: 'task',
      id: 't-b',
      by: 'agent',
      text: 'y',
      why: null,
      extra: null,
    },
    {
      ts: '2026-03-03T10:00:00Z',
      op: 'task',
      id: 't-a',
      by: 'agent',
      text: 'x',
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 2  10:00  task      t-a        agent  x',
      'day 3  10:00  task      t-b        agent  y',
      '',
    ].join('\n'),
  );
});

test('it prints a journal of 100000 rows', () => {
  const rows: JournalRow[] = Array.from({ length: 100_000 }, () => ({
    ts: '2026-03-03T10:00:00Z',
    op: 'task',
    id: 't-a',
    by: 'agent',
    text: 'x',
    why: null,
    extra: null,
  }));

  expect(renderLog(rows, '2026-03-02T08:04:11Z').split('\n')).toHaveLength(100_001);
});

test('it shows owed: before an owed note, note cleared for a cleared note and import as who', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'note',
      id: 't-a',
      by: 'agent',
      text: 'Stop the simulator',
      why: null,
      extra: 'owed=1',
    },
    {
      ts: '2026-03-10T10:49:15Z',
      op: 'note',
      id: 't-a',
      by: 'agent',
      text: null,
      why: null,
      extra: 'cleared=1',
    },
    {
      ts: '2026-03-10T10:50:15Z',
      op: 'note',
      id: 't-b',
      by: 'import',
      text: 'Kept from the hand-kept store',
      why: null,
      extra: null,
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 9  10:48  note      t-a        agent  owed: Stop the simulator',
      'day 9  10:49  note      t-a        agent  note cleared',
      'day 9  10:50  note      t-b        import Kept from the hand-kept store',
      '',
    ].join('\n'),
  );
});

test('it labels the second line of a grant row reading', () => {
  const rows: JournalRow[] = [
    {
      ts: '2026-03-10T10:48:15Z',
      op: 'grant',
      id: 'grant',
      by: 'owner',
      text: 'Merge the alert PRs yourself.',
      why: 'covers merges on green CI',
      extra: 'where=chat',
    },
  ];

  expect(renderLog(rows, '2026-03-02T08:04:11Z')).toBe(
    [
      'day 9  10:48  grant     grant      owner  Merge the alert PRs yourself.',
      '                                          reading: covers merges on green CI',
      '',
    ].join('\n'),
  );
});
