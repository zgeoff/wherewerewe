import { expect, test } from 'bun:test';
import { parseSessionFile } from './parse-session-file.ts';

test('it reads a format 1 session, with an empty value as null', () => {
  const goodText = [
    'format=1',
    'name=tide-alerts',
    'goal=Ship it',
    'started=2026-03-02T08:04:11Z',
    'now=t-a',
    'now_next=go',
    'now_set=2026-03-10T10:31:09Z',
    'last_write=2026-03-10T11:02:40Z',
    'last_nudge=',
    '',
  ].join('\n');

  expect(parseSessionFile(goodText)).toStrictEqual({
    kind: 'session',
    session: {
      format: '1',
      name: 'tide-alerts',
      goal: 'Ship it',
      started: '2026-03-02T08:04:11Z',
      now: 't-a',
      nowNext: 'go',
      nowSet: '2026-03-10T10:31:09Z',
      lastWrite: '2026-03-10T11:02:40Z',
      lastNudge: null,
      importedFrom: null,
    },
  });
});

test.each([
  ['a session with no format line', 'name=a\ngoal=b\nstarted=c\n', { kind: 'hand-kept' }],
  ['a hand-kept format', 'format=0-by-hand\nname=a\n', { kind: 'hand-kept' }],
  ['a newer format', 'format=2\nname=a\n', { kind: 'newer', format: '2' }],
  [
    'an unknown key',
    'format=1\nname=a\ngoal=b\nstarted=c\ncolour=red\n',
    { kind: 'broken', reason: 'the key colour is not in format 1' },
  ],
  [
    'a missing name',
    'format=1\ngoal=b\nstarted=c\n',
    { kind: 'broken', reason: 'name and goal are required' },
  ],
  [
    'a line with no equals sign',
    'format=1\nnonsense\n',
    { kind: 'broken', reason: 'the line "nonsense" is not key=value' },
  ],
])('it reads %s as %p', (_title, text, expected) => {
  expect<unknown>(parseSessionFile(text)).toStrictEqual(expected);
});
