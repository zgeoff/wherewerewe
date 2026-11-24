import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedStubCommand } from './seed-stub-command.ts';

test('it makes an executable script that runs and prints what it was given', async () => {
  const folder = createTempDir('stub-command').path;

  seedStubCommand(folder, 'gh', 'echo "stub $1"');

  const run = Bun.spawn([join(folder, 'gh'), 'view'], { stdout: 'pipe' });

  const stdout = await new Response(run.stdout).text();

  expect(stdout).toBe('stub view\n');
});
