import { expect, test } from 'bun:test';
import { buildSessionLines } from '../test-utils/build-session-lines.ts';
import { parseSessionFile } from './parse-session-file.ts';

test('it reads a format 2 session with no grant, an empty value as null', () => {
  const goodText = [
    ...buildSessionLines(),
    'grant=',
    'grant_reading=',
    'grant_where=',
    'grant_set=',
    '',
  ].join('\n');

  expect(parseSessionFile(goodText)).toStrictEqual({
    kind: 'session',
    session: {
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
      importedFrom: null,
    },
  });
});

test('it reads a format 2 session with a grant', () => {
  const goodText = [
    ...buildSessionLines(),
    'grant=Merge the alert PRs yourself.',
    'grant_reading=covers merges on green CI',
    'grant_where=chat',
    'grant_set=2026-03-03T09:00:00Z',
    '',
  ].join('\n');

  expect(parseSessionFile(goodText)).toStrictEqual({
    kind: 'session',
    session: {
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
  ['format 1', 'format=1\nname=a\ngoal=b\nstarted=c\n', { kind: 'format-1' }],
  [
    'format 1 with a line that is not key=value',
    'format=1\nfuture field syntax\n',
    { kind: 'format-1' },
  ],
  ['a newer format', 'format=3\nname=a\n', { kind: 'newer', format: '3' }],
  [
    'a newer format with a line that is not key=value',
    'format=3\nfuture field syntax\n',
    { kind: 'newer', format: '3' },
  ],
  [
    'an unknown key',
    'format=2\nname=a\ngoal=b\nstarted=c\ncolour=red\n',
    { kind: 'broken', reason: 'the key colour is not in format 2' },
  ],
  [
    'a missing name',
    'format=2\ngoal=b\nstarted=c\n',
    { kind: 'broken', reason: 'name and goal are required' },
  ],
  [
    'a line with no equals sign',
    'format=2\nnonsense\n',
    { kind: 'broken', reason: 'the line "nonsense" is not key=value' },
  ],
  [
    'three of the four grant keys set',
    'format=2\nname=a\ngoal=b\nstarted=c\ngrant=words\ngrant_reading=r\ngrant_where=chat\ngrant_set=\n',
    { kind: 'broken', reason: 'the grant keys are not all set or all empty' },
  ],
  [
    'grant words over 700 characters',
    `format=2\nname=a\ngoal=b\nstarted=c\ngrant=${'w'.repeat(701)}\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant is 701 characters, and the limit is 700' },
  ],
  [
    'a grant reading over 200 characters',
    `format=2\nname=a\ngoal=b\nstarted=c\ngrant=w\ngrant_reading=${'r'.repeat(201)}\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_reading is 201 characters, and the limit is 200' },
  ],
  [
    'a grant place over 16 characters',
    `format=2\nname=a\ngoal=b\nstarted=c\ngrant=w\ngrant_reading=r\ngrant_where=${'p'.repeat(17)}\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_where is 17 characters, and the limit is 16' },
  ],
])('it reads %s as %p', (_title, text, expected) => {
  const actual: unknown = parseSessionFile(text);

  expect(actual).toStrictEqual(expected);
});
