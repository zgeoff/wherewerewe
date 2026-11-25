import { expect, test } from 'bun:test';
import fc from 'fast-check';
import { runHookCommand } from '../commands/run-hook-command.ts';
import type { Harness } from '../hooks/types.ts';
import { runCLI } from '../run-cli.ts';
import { buildHookModelOps } from './build-hook-model-ops.ts';
import { runHookModel } from './run-hook-model.ts';
import type { HookModelOp, HookModelRunners } from './run-hook-model.ts';

function setupTest() {
  return {
    ops: buildHookModelOps(),

    // a sequence that runs each command the model runs: the brief, attach, and the hook on each kind of
    // reply, the injection, a refusal, nothing and the line of a failed gate
    everyCommand: [
      { kind: 'call', payload: 'start-startup', from: 'main' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
      { kind: 'call', payload: 'pre-brief', from: 'main' },
      { kind: 'call', payload: 'end-failed', from: 'main' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
      { kind: 'attach' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
    ] satisfies HookModelOp[],

    // the real commands, with the stdout of the one named made empty or changed
    changeReply: (command: 'attach' | 'brief' | 'hook', change: 'empty' | 'changed') => {
      const reply = (stdout: string) => (change === 'empty' ? '' : `${stdout}x`);

      const runners: HookModelRunners = {
        runCLI: async (input) => {
          const result = await runCLI(input);

          const isAttach = input.argv[0] === 'attach';

          return (command === 'attach') === isAttach && command !== 'hook'
            ? { ...result, stdout: reply(result.stdout) }
            : result;
        },
        runHookCommand: async (harness, stdinText, context) => {
          const result = await runHookCommand(harness, stdinText, context);

          return command === 'hook' ? { ...result, stdout: reply(result.stdout) } : result;
        },
      };

      return runners;
    },

    // runs the sequence under many schedules of two hooks that wait for the lock together
    holds: (harness: Harness, ops: readonly HookModelOp[], numRuns: number) =>
      fc.assert(
        fc.asyncProperty(fc.scheduler(), async (scheduler) => {
          const problems = await runHookModel(harness, ops, scheduler);

          expect(problems.slice(0, 3)).toStrictEqual([]);
        }),
        { numRuns },
      ),
  };
}

test.each(['claude', 'codex'] as const)(
  'it keeps the real hook command equal to the model over generated sequences on %s',
  async (harness) => {
    const ctx = setupTest();

    await fc.assert(
      fc.asyncProperty(
        fc.array(ctx.ops, { minLength: 1, maxLength: 10 }),
        fc.scheduler(),
        async (ops, scheduler) => {
          const problems = await runHookModel(harness, ops, scheduler);

          expect(problems.slice(0, 3)).toStrictEqual([]);
        },
      ),
      { numRuns: 15 },
    );
  },
);

test('it runs a late end across a wipe, and finds the end counted against the new state', async () => {
  const ctx = setupTest();

  await ctx.holds(
    'claude',
    [
      { kind: 'call', payload: 'start-startup', from: 'main' },
      { kind: 'call', payload: 'pre-brief', from: 'main' },
      { kind: 'call', payload: 'start-compact', from: 'main' },
      { kind: 'call', payload: 'end-whole', from: 'main' },
    ],
    3,
  );
});

test('it runs a brief command whose id is attached to another store mid-sequence', async () => {
  const ctx = setupTest();

  await ctx.holds(
    'codex',
    [
      { kind: 'call', payload: 'start-resume', from: 'main' },
      { kind: 'call', payload: 'pre-brief', from: 'main' },
      { kind: 'call', payload: 'end-whole', from: 'main' },
      { kind: 'attach' },
      { kind: 'call', payload: 'pre-ls', from: 'main' },
      { kind: 'call', payload: 'pre-brief-session', from: 'main' },
    ],
    3,
  );
});

test('it runs two hooks of one agent session together and finds one serial order', async () => {
  const ctx = setupTest();

  await ctx.holds(
    'claude',
    [
      { kind: 'call', payload: 'start-startup', from: 'main' },
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
    ],
    10,
  );
});

test.each(['claude', 'codex'] as const)(
  'it keeps the gate closed while a brief command that began before a wipe still runs on %s',
  async (harness) => {
    const ctx = setupTest();

    await ctx.holds(
      harness,
      [
        { kind: 'call', payload: 'start-startup', from: 'main' },
        { kind: 'call', payload: 'pre-brief', from: 'main' },
        { kind: 'call', payload: 'start-clear', from: 'main' },
        { kind: 'call', payload: 'pre-brief', from: 'main' },
        { kind: 'call', payload: 'end-failed', from: 'main' },
        { kind: 'call', payload: 'pre-ls', from: 'main' },
        { kind: 'call', payload: 'end-whole', from: 'main' },
        { kind: 'call', payload: 'pre-ls', from: 'main' },
      ],
      3,
    );
  },
);

test.each(['claude', 'codex'] as const)(
  'it prints the same injection for each SessionStart source and the SubagentStart line on %s',
  async (harness) => {
    const ctx = setupTest();

    await ctx.holds(
      harness,
      [
        { kind: 'call', payload: 'start-startup', from: 'main' },
        { kind: 'call', payload: 'start-resume', from: 'main' },
        { kind: 'call', payload: 'start-clear', from: 'main' },
        { kind: 'call', payload: 'start-compact', from: 'main' },
        { kind: 'call', payload: 'start-fork', from: 'main' },
        { kind: 'call', payload: 'subagent-start', from: 'main' },
        { kind: 'call', payload: 'subagent-start', from: 'unbound' },
      ],
      3,
    );
  },
);

test.each([
  ['attach', 'empty'],
  ['attach', 'changed'],
  ['brief', 'empty'],
  ['brief', 'changed'],
  ['hook', 'empty'],
  ['hook', 'changed'],
] as const)('it finds the reply of %s when it is %s, on both hosts', async (command, change) => {
  const ctx = setupTest();
  const runners = ctx.changeReply(command, change);

  await fc.assert(
    fc.asyncProperty(fc.scheduler(), async (scheduler) => {
      const found = await Promise.all(
        (['claude', 'codex'] as const).map(async (harness) => {
          const problems = await runHookModel(harness, ctx.everyCommand, scheduler, runners);

          return problems.length > 0;
        }),
      );

      expect(found).toStrictEqual([true, true]);
    }),
    { numRuns: 1 },
  );
});
