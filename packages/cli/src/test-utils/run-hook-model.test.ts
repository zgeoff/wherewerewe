import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { buildHookModelOps } from './build-hook-model-ops.ts';
import { runHookModel } from './run-hook-model.ts';

function setupTest() {
  return { run: runHookModel, ops: buildHookModelOps() };
}

test.each(['claude', 'codex'] as const)(
  'it keeps the real hook command equal to the model over generated sequences on %s',
  async (harness) => {
    const ctx = setupTest();

    await fc.assert(
      fc.asyncProperty(fc.array(ctx.ops, { minLength: 1, maxLength: 10 }), async (ops) => {
        const problems = await ctx.run(harness, ops);

        expect(problems.slice(0, 3)).toStrictEqual([]);
      }),
      { numRuns: 15 },
    );
  },
);

test('it runs a late end across a wipe, and finds the end counted against the new state', async () => {
  const ctx = setupTest();

  const problems = await ctx.run('claude', [
    { kind: 'call', payload: 'start', from: 'main' },
    { kind: 'call', payload: 'pre-brief', from: 'main' },
    { kind: 'call', payload: 'start', from: 'main' },
    { kind: 'call', payload: 'end-whole', from: 'main' },
  ]);

  expect(problems).toStrictEqual([]);
});

test('it runs a brief command whose id is attached to another store mid-sequence', async () => {
  const ctx = setupTest();

  const problems = await ctx.run('codex', [
    { kind: 'call', payload: 'start', from: 'main' },
    { kind: 'call', payload: 'pre-brief', from: 'main' },
    { kind: 'call', payload: 'end-whole', from: 'main' },
    { kind: 'attach' },
    { kind: 'call', payload: 'pre-ls', from: 'main' },
    { kind: 'call', payload: 'pre-brief-session', from: 'main' },
  ]);

  expect(problems).toStrictEqual([]);
});

test('it runs two hooks of one agent session together and finds one serial order', async () => {
  const ctx = setupTest();

  const problems = await ctx.run('claude', [
    { kind: 'call', payload: 'start', from: 'main' },
    {
      kind: 'together',
      first: { payload: 'pre-brief', from: 'main' },
      second: { payload: 'pre-brief', from: 'main' },
    },
    {
      kind: 'together',
      first: { payload: 'end-failed', from: 'main' },
      second: { payload: 'pre-ls', from: 'main' },
    },
  ]);

  expect(problems).toStrictEqual([]);
});

test.each(['claude', 'codex'] as const)(
  'it keeps the gate closed while a brief command that began before a wipe still runs on %s',
  async (harness) => {
    const ctx = setupTest();

    const problems = await ctx.run(harness, [
      { kind: 'call', payload: 'start', from: 'main' },
      { kind: 'call', payload: 'pre-brief', from: 'main' },
      { kind: 'call', payload: 'start', from: 'main' },
      { kind: 'call', payload: 'pre-brief', from: 'main' },
      { kind: 'call', payload: 'end-failed', from: 'main' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
      { kind: 'call', payload: 'end-whole', from: 'main' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
    ]);

    expect(problems).toStrictEqual([]);
  },
);
