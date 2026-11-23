import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStaleLock } from './seed-stale-lock.ts';

test('it writes a lock whose process has exited', async () => {
  const folder = createTempDir('stale-lock').path;

  await seedStaleLock(folder);

  const lock = readFileSync(join(folder, 'lock'), 'utf8');
  const pid = Number(/^pid=(?<pid>\d+) /u.exec(lock)?.groups?.['pid']);

  expect(() => process.kill(pid, 0)).toThrow();
});
