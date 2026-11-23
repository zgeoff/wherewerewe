import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { writeBinding } from './write-binding.ts';

function setupTest() {
  return { root: join(createTempDir('write-binding').path, 'wherewerewe') };
}

test('it writes name=<session> to a file named for the harness and id, and leaves no temporary file', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: '0f3a-alpha' }, 'alpha-notes');

  expect(readdirSync(join(ctx.root, '.bindings'))).toStrictEqual(['claude-0f3a-alpha']);

  expect(readFileSync(join(ctx.root, '.bindings', 'claude-0f3a-alpha'), 'utf8')).toBe(
    'name=alpha-notes\n',
  );
});

test('it replaces an earlier binding of the same agent', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'codex', id: 'x1' }, 'alpha-notes');
  await writeBinding(ctx.root, { harness: 'codex', id: 'x1' }, 'beta-notes');

  expect(readFileSync(join(ctx.root, '.bindings', 'codex-x1'), 'utf8')).toBe('name=beta-notes\n');
});
