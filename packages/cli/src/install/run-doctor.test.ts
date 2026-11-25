import { expect, test } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createTestHome } from '../test-utils/create-test-home.ts';

function setupTest() {
  return createTestHome();
}

test('it exits 3 from doctor before install, and 0 after', async () => {
  const ctx = setupTest();

  const before = await ctx.www(['doctor']);

  await ctx.www(['install']);

  const after = await ctx.www(['doctor']);

  expect([before.exitCode, after.exitCode]).toStrictEqual([3, 0]);
});

test('it tells doctor when Codex cannot write the store', async () => {
  const ctx = setupTest();

  await ctx.www(['install']);

  await mkdir(join(ctx.home, '.codex'), { recursive: true });
  await writeFile(join(ctx.home, '.codex/config.toml'), '[features]\nhooks = true\n');

  const result = await ctx.www(['doctor', '--human']);

  expect({
    exitCode: result.exitCode,
    names: result.stdout.includes('writable_roots'),
  }).toStrictEqual({
    exitCode: 3,
    names: true,
  });
});
