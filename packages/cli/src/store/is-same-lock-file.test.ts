import { expect, test } from 'bun:test';
import { isSameLockFile } from './is-same-lock-file.ts';

test.each([
  ['the same inode and content', { ino: 7, content: 'pid=1 ts=a\n', mtimeMs: 5 }, true],
  ['another inode', { ino: 8, content: 'pid=1 ts=a\n', mtimeMs: 0 }, false],
  ['other content', { ino: 7, content: 'pid=2 ts=a\n', mtimeMs: 0 }, false],
  ['no file', null, false],
] as const)('it reads a file with %s as the same: %p', (_, current, same) => {
  const seen = { ino: 7, content: 'pid=1 ts=a\n', mtimeMs: 0 };

  expect(isSameLockFile(current, seen)).toBe(same);
});
