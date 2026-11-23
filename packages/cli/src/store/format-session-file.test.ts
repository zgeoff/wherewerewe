import { expect, test } from 'bun:test';
import { formatSessionFile } from './format-session-file.ts';
import { parseSessionFile } from './parse-session-file.ts';

test('it writes the keys in the design order with an empty value as key=', () => {
  const text = formatSessionFile({
    format: '1',
    name: 'tide-alerts',
    goal: 'Ship it = done',
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
      'format=1',
      'name=tide-alerts',
      'goal=Ship it = done',
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

test('it writes imported_from only when set, and the file reads back the same', () => {
  const session = {
    format: '1',
    name: 'tide-alerts',
    goal: 'Ship it',
    started: '2026-03-02T08:04:11Z',
    now: 't-a',
    nowNext: 'go',
    nowSet: '2026-03-10T10:31:09Z',
    lastWrite: '2026-03-10T11:02:40Z',
    lastNudge: null,
    importedFrom: '0-by-hand',
  } as const;

  expect(parseSessionFile(formatSessionFile(session))).toStrictEqual({ kind: 'session', session });
});
