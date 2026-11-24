import { expect, test } from 'bun:test';
import type { SessionFile } from '../types.ts';
import { formatSessionFile } from './format-session-file.ts';
import { parseSessionFile } from './parse-session-file.ts';

test('it writes the keys in the design order, the grant keys empty with no grant', () => {
  const text = formatSessionFile({
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it = done',
    grant: null,
    started: '2026-03-02T08:04:11Z',
    now: null,
    nowNext: null,
    nowSet: null,
    lastWrite: '2026-03-10T11:02:40Z',
    lastNudge: null,
    importedFrom: null,
  });

  expect(text).toBe(
    [
      'format=2',
      'name=tide-alerts',
      'goal=Ship it = done',
      'grant_scope=',
      'grant_reading=',
      'grant_where=',
      'grant_set=',
      'started=2026-03-02T08:04:11Z',
      'now=',
      'now_next=',
      'now_set=',
      'last_write=2026-03-10T11:02:40Z',
      'last_nudge=',
      '',
    ].join('\n'),
  );
});

test('it writes the bullet lines in order, then the four grant keys, after the goal', () => {
  const text = formatSessionFile({
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: {
      may: ['water the beds', 'mow the lawn'],
      not: ['prune the roses'],
      never: ['dig up the roses'],
      scope: 'in the east garden',
      reading: 'covers watering and mowing',
      where: 'chat',
      set: '2026-03-03T09:00:00Z',
    },
    started: '2026-03-02T08:04:11Z',
    now: null,
    nowNext: null,
    nowSet: null,
    lastWrite: null,
    lastNudge: null,
    importedFrom: null,
  });

  expect(text.split('\n').slice(0, 13)).toStrictEqual([
    'format=2',
    'name=tide-alerts',
    'goal=Ship it',
    'grant_may=water the beds',
    'grant_may=mow the lawn',
    'grant_not=prune the roses',
    'grant_never=dig up the roses',
    'grant_scope=in the east garden',
    'grant_reading=covers watering and mowing',
    'grant_where=chat',
    'grant_set=2026-03-03T09:00:00Z',
    'started=2026-03-02T08:04:11Z',
    'now=',
  ]);
});

test('it writes imported_from only when set, and the file reads back the same', () => {
  const session: SessionFile = {
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: null,
    started: '2026-03-02T08:04:11Z',
    now: 't-a',
    nowNext: 'go',
    nowSet: '2026-03-10T10:31:09Z',
    lastWrite: '2026-03-10T11:02:40Z',
    lastNudge: null,
    importedFrom: '0-by-hand',
  };

  expect(parseSessionFile(formatSessionFile(session))).toStrictEqual({ kind: 'session', session });
});

test('it reads back a grant of 12 bullets and a 40-character scope, 700 characters in all, with a reading of 200', () => {
  const session: SessionFile = {
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: {
      may: ['m'.repeat(55), 'm'.repeat(55), 'm'.repeat(55), 'm'.repeat(55)],
      not: ['n'.repeat(55), 'n'.repeat(55), 'n'.repeat(55), 'n'.repeat(55)],
      never: ['v'.repeat(55), 'v'.repeat(55), 'v'.repeat(55), 'v'.repeat(55)],
      scope: 's'.repeat(40),
      reading: 'r'.repeat(200),
      where: 'terminal-123456789'.slice(0, 16),
      set: '2026-03-03T09:00:00Z',
    },
    started: '2026-03-02T08:04:11Z',
    now: null,
    nowNext: null,
    nowSet: null,
    lastWrite: null,
    lastNudge: null,
    importedFrom: null,
  };

  expect(parseSessionFile(formatSessionFile(session))).toStrictEqual({ kind: 'session', session });
});
