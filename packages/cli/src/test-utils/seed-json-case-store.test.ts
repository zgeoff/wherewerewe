import { expect, test } from 'bun:test';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedJsonCaseStore } from './seed-json-case-store.ts';

function setupTest() {
  const root = createTempDir('seed-json-case-store').path;

  return {
    root,
    seed: seedJsonCaseStore,
    readKind: async () => {
      const read = await readStore(join(root, 'wherewerewe', 'tide-alerts'));

      return read.kind;
    },
  };
}

test.each([
  { state: 'a whole store' as const, kind: 'store' as const },
  { state: 'a held lock' as const, kind: 'store' as const },
  { state: 'a format 1 store' as const, kind: 'format-1' as const },
  { state: 'a hand-kept store' as const, kind: 'hand-kept' as const },
  { state: 'a newer store' as const, kind: 'newer' as const },
  { state: 'a session that does not parse' as const, kind: 'broken' as const },
  { state: 'no session' as const, kind: 'missing' as const },
])('it seeds $state, which reads as $kind', async (row) => {
  const ctx = setupTest();

  await ctx.seed(ctx.root, row.state);

  const kind = await ctx.readKind();

  expect(kind).toBe(row.kind);
});

test('it makes the folder of a read-only store read-only until the restore runs', async () => {
  const ctx = setupTest();

  const restore = await ctx.seed(ctx.root, 'a read-only store folder');

  const folder = join(ctx.root, 'wherewerewe', 'tide-alerts');
  const readOnly = statSync(folder).mode % 0o1000;

  restore();

  expect([readOnly, statSync(folder).mode % 0o1000]).toStrictEqual([0o555, 0o755]);
});
