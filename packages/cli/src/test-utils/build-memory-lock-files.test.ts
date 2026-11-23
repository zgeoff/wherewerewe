import { expect, test } from 'bun:test';
import { readProcess } from '../store/read-process.ts';
import { buildMemoryLockFiles } from './build-memory-lock-files.ts';

test('it creates a file once, reads it back with inode 7, and removes it', () => {
  const memory = buildMemoryLockFiles();

  const outcome = {
    first: memory.files.create('lock', 'pid=1 ts=a\n'),
    second: memory.files.create('lock', 'pid=2 ts=b\n'),
    seen: memory.readSeen('lock'),
  };

  memory.files.remove('lock');

  expect({ ...outcome, after: memory.files.read('lock') }).toStrictEqual({
    first: { ino: 7, content: 'pid=1 ts=a\n', mtimeMs: 0 },
    second: null,
    seen: { ino: 7, content: 'pid=1 ts=a\n', mtimeMs: 0 },
    after: null,
  });
});

test('it throws from readSeen when the file is missing', () => {
  expect(() => buildMemoryLockFiles().readSeen('lock')).toThrow();
});

test('it reads the processes of the system', () => {
  const memory = buildMemoryLockFiles();

  expect(memory.files.readProcess(process.pid)).toStrictEqual(readProcess(process.pid));
});
