import { expect, test } from 'bun:test';
import { buildClaimPath } from './build-claim-path.ts';

test.each([
  ['another inode', { ino: 8, content: 'pid=1 ts=a\n', mtimeMs: 0 }],
  ['other content', { ino: 7, content: 'pid=2 ts=a\n', mtimeMs: 0 }],
])('it names a different claim for a file with %s', (_title, other) => {
  const seen = { ino: 7, content: 'pid=1 ts=a\n', mtimeMs: 0 };

  expect({
    claim: buildClaimPath('/srv/notes/lock', seen),
    other: buildClaimPath('/srv/notes/lock', other) === buildClaimPath('/srv/notes/lock', seen),
    again: buildClaimPath('/srv/notes/lock', { ...seen, mtimeMs: 5 }),
  }).toStrictEqual({
    claim: expect.stringMatching(/^\/srv\/notes\/lock\.claim-7-[0-9a-f]{12}$/u),
    other: false,
    again: buildClaimPath('/srv/notes/lock', seen),
  });
});
