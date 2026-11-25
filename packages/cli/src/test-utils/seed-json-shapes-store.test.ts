import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { seedJsonShapesStore } from './seed-json-shapes-store.ts';

function setupTest() {
  return { root: createTempDir('seed-json-shapes-store').path, seed: seedJsonShapesStore };
}

test.each([['day 9' as const], ['worst case' as const]])(
  'it seeds the %s store, which a brief reads',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);

    const result = await runCLI({
      argv: [],
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

    expect(result.exitCode).toBe(0);
  },
);
