import { expect, test } from 'bun:test';
import { buildSessionLines } from '../test-utils/build-session-lines.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { parseSessionFile } from './parse-session-file.ts';

test('it reads a format 2 session with no grant, an empty value as null', () => {
  const goodText = [
    ...buildSessionLines(),
    'grant_scope=',
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

test('it reads a format 2 session with a grant, each bullet group in its order', () => {
  const goodText = [
    ...buildSessionLines(),
    'grant_may=water the beds',
    'grant_may=mow the lawn',
    'grant_not=prune the roses',
    'grant_never=dig up the roses',
    'grant_never=burn the leaves',
    'grant_scope=in the east garden',
    'grant_reading=covers watering and mowing',
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
        may: ['water the beds', 'mow the lawn'],
        not: ['prune the roses'],
        never: ['dig up the roses', 'burn the leaves'],
        scope: 'in the east garden',
        reading: 'covers watering and mowing',
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
  [
    'a session with no format line',
    'name=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n',
    { kind: 'hand-kept' },
  ],
  ['a hand-kept format', 'format=0-by-hand\nname=a\n', { kind: 'hand-kept' }],
  ['format 1', 'format=1\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n', { kind: 'format-1' }],
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
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ncolour=red\n',
    { kind: 'broken', reason: 'the key colour is not in format 2' },
  ],
  [
    'a missing name',
    'format=2\ngoal=b\nstarted=2026-03-02T08:04:11Z\n',
    { kind: 'broken', reason: 'name and goal are required' },
  ],
  [
    'a started that is no UTC time',
    'format=2\nname=a\ngoal=b\nstarted=yesterday\n',
    { kind: 'broken', reason: 'the key started is not a UTC time' },
  ],
  [
    'a line with no equals sign',
    'format=2\nnonsense\n',
    { kind: 'broken', reason: 'the line "nonsense" is not key=value' },
  ],
  [
    'a grant_not line with grant_reading empty',
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_not=prune the roses\ngrant_scope=\ngrant_reading=\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n',
    {
      kind: 'broken',
      reason: 'a grant needs a bullet line and grant_reading, grant_where and grant_set',
    },
  ],
  [
    'a grant_may line with grant_set empty',
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=water the beds\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=\n',
    {
      kind: 'broken',
      reason: 'a grant needs a bullet line and grant_reading, grant_where and grant_set',
    },
  ],
  [
    'bullets that take 20 lines in the brief',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=${buildSpacedText(649, 74)}\n${'grant_may=o\n'.repeat(11)}grant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the grant takes 20 lines in the brief, and the limit is 19' },
  ],
  [
    '13 bullets',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n${'grant_may=water\n'.repeat(13)}grant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the grant has 13 bullets, and the limit is 12' },
  ],
  [
    'owner words over 700 characters across bullets and scope',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n${`grant_may=${'w'.repeat(120)}\n`.repeat(5)}grant_not=${'n'.repeat(100)}\ngrant_scope=s\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: "the grant's words are 701 characters, and the limit is 700" },
  ],
  [
    'a grant scope over 40 characters',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=water the beds\ngrant_scope=${'s'.repeat(41)}\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_scope is 41 characters, and the limit is 40' },
  ],
  [
    'a grant reading over 200 characters',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=${'r'.repeat(201)}\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_reading is 201 characters, and the limit is 200' },
  ],
  [
    'a grant place over 16 characters',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=r\ngrant_where=${'p'.repeat(17)}\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_where is 17 characters, and the limit is 16' },
  ],
  [
    'a grant bullet with a tab',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=water\tthe beds\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'a grant bullet holds a tab or a line break' },
  ],
  [
    'a grant bullet with a line separator',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=water\u2028the beds\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'a grant bullet holds a tab or a line break' },
  ],
  [
    'a grant bullet of a lone dash',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=-\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'a grant bullet is empty' },
  ],
  [
    'a grant bullet with the bullet mark',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=water • mow\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'a grant bullet holds •' },
  ],
  [
    'a grant bullet that looks like a credential',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=token ${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    {
      kind: 'broken',
      reason: 'a grant bullet looks like a credential (it matches the ghp pattern)',
    },
  ],
  [
    'a grant scope of a lone dash',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=-\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_scope is empty' },
  ],
  [
    'a grant reading with a paragraph separator',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=r\u2029s\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_reading holds a tab or a line break' },
  ],
  [
    'a grant place with a separator',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=r\ngrant_where=chat;x\ngrant_set=2026-03-03T09:00:00Z\n`,
    { kind: 'broken', reason: 'the key grant_where holds ; or =' },
  ],
  [
    'a grant set that is no UTC time',
    `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=yesterday\n`,
    { kind: 'broken', reason: 'the key grant_set is not a UTC time' },
  ],
  [
    'a line with no equals sign that looks like a credential',
    `format=2\n${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}\n`,
    { kind: 'broken', reason: 'the line "<where the secret lives>" is not key=value' },
  ],
  [
    'a grant scope with the bullet mark',
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=beds • shed\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n',
    { kind: 'broken', reason: 'the key grant_scope holds •' },
  ],
  [
    'a grant reading with the bullet mark',
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=\ngrant_reading=works • fine\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n',
    { kind: 'broken', reason: 'the key grant_reading holds •' },
  ],
  [
    'a repeated grant_scope key',
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=w\ngrant_scope=one\ngrant_scope=two\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n',
    { kind: 'broken', reason: 'the key grant_scope repeats' },
  ],
  [
    'a repeated goal key',
    'format=2\nname=a\ngoal=b\ngoal=c\nstarted=2026-03-02T08:04:11Z\n',
    { kind: 'broken', reason: 'the key goal repeats' },
  ],
])('it reads %s as %p', (_title, text, expected) => {
  const actual: unknown = parseSessionFile(text);

  expect(actual).toStrictEqual(expected);
});

test('it reads 700 characters of owner words across bullets and scope', () => {
  const text = `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n${`grant_may=${'w'.repeat(120)}\n`.repeat(5)}grant_not=${'n'.repeat(99)}\ngrant_scope=s\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`;

  expect(parseSessionFile(text)).toMatchObject({
    kind: 'session',
    session: { grant: { not: ['n'.repeat(99)], scope: 's' } },
  });
});

test('it reads bullets of one group in file order when other keys sit between them', () => {
  const text =
    'format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=third\ngrant_never=x\ngrant_may=first\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n';

  expect(parseSessionFile(text)).toMatchObject({
    kind: 'session',
    session: { grant: { may: ['third', 'first'], never: ['x'], scope: null } },
  });
});

test.each([
  { group: 'grant_not', key: 'not' },
  { group: 'grant_never', key: 'never' },
])('it reads a grant with only $group lines as a grant with no may bullet', (row) => {
  const text = `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n${row.group}=prune the roses\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`;

  expect(parseSessionFile(text)).toMatchObject({
    kind: 'session',
    session: { grant: { may: [], [row.key]: ['prune the roses'] } },
  });
});

test('it reads a bullet of 162 characters', () => {
  const bullet = buildSpacedText(162);
  const text = `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\ngrant_may=${bullet}\ngrant_scope=\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`;

  expect(parseSessionFile(text)).toMatchObject({
    kind: 'session',
    session: { grant: { may: [bullet] } },
  });
});

test('it reads the widest grant of 7 bullets of 90 and 5 of 6 with a scope of 40, which takes 19 lines', () => {
  const text = `format=2\nname=a\ngoal=b\nstarted=2026-03-02T08:04:11Z\n${`grant_may=${'m'.repeat(90)}\n`.repeat(7)}${'grant_not=xxxxxx\n'.repeat(5)}grant_scope=${'s'.repeat(40)}\ngrant_reading=r\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\n`;

  expect(parseSessionFile(text)).toMatchObject({
    kind: 'session',
    session: { grant: { may: Array.from({ length: 7 }, () => 'm'.repeat(90)) } },
  });
});
