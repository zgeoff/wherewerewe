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

test('it says when no row is left', () => {
  expect(renderLog([], '2026-03-02T08:04:11Z')).toBe('No journal rows match.\n');
});
