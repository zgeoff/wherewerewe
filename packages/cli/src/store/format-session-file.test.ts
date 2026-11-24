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
      'grant=',
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

test('it writes the four grant keys after the goal when the session holds a grant', () => {
  const text = formatSessionFile({
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: {
      words: 'Merge the alert PRs yourself.',
      reading: 'covers merges on green CI',
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

  expect(text.split('\n').slice(0, 8)).toStrictEqual([
    'format=2',
    'name=tide-alerts',
    'goal=Ship it',
    'grant=Merge the alert PRs yourself.',
    'grant_reading=covers merges on green CI',
    'grant_where=chat',
    'grant_set=2026-03-03T09:00:00Z',
    'started=2026-03-02T08:04:11Z',
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

test('it reads back a grant of 700 characters of words and a reading of 200', () => {
  const session: SessionFile = {
    format: '2',
    name: 'tide-alerts',
    goal: 'Ship it',
    grant: {
      words: 'w'.repeat(700),
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
