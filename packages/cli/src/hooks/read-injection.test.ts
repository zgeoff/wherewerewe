import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { seedDayNineStore } from '../test-utils/seed-day-nine-store.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { seedWorstCaseStore } from '../test-utils/seed-worst-case-store.ts';
import { readInjection } from './read-injection.ts';

function setupTest() {
  const root = createTempDir('read-injection').path;
  const nowMs = Date.parse('2026-03-10T11:43:00Z');

  return {
    root,
    nowMs,
    read: (folder: string, name: string, harness: 'claude' | 'codex') =>
      readInjection(folder, name, harness, nowMs),
  };
}

test.each(['claude', 'codex'] as const)(
  'it prints the goal and grant blocks of the brief, then the two lines, for the day-9 store on %s',
  async (harness) => {
    const ctx = setupTest();

    const day = await seedDayNineStore(ctx.root);

    const brief = await runCLI({
      argv: [],
      env: day.env,
      cwd: ctx.root,
      terminal: { stdin: false, stdout: false },
      now: () => ctx.nowMs,
    });

    const injection = await ctx.read(join(day.stateRoot, 'tide-alerts'), 'tide-alerts', harness);

    const lines = (injection ?? '').trimEnd().split('\n');
    const blocks = lines.slice(0, -2);

    expect({
      startsWithGoal: blocks[0]?.startsWith('GOAL  '),
      inBrief: brief.stdout.includes(`${blocks.join('\n')}\n`),
      tail: lines.slice(-2),
    }).toStrictEqual({
      startsWithGoal: true,
      inBrief: true,
      tail: [
        "wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.",
        harness === 'codex'
          ? 'Run: www   (pass max_output_tokens 10000, so the whole brief reaches you)'
          : 'Run: www',
      ],
    });
  },
);

test('it prints the brief line for no grant', async () => {
  const ctx = setupTest();

  const folder = await seedSessionStore(ctx.root, 'tide-alerts');
  const injection = await ctx.read(folder, 'tide-alerts', 'claude');

  expect(injection?.split('\n')[1]).toBe(
    'GRANT  none. Run: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"',
  );
});

test.each([
  { title: 'a format 1 store', place: (root: string) => seedFormat1Store(root, 'tide-alerts') },
  {
    title: 'a hand-kept store',
    place: (root: string) => {
      seedStoreFile(join(root, 'tide-alerts'), 'session', 'format=0-by-hand\nname=tide-alerts\n');

      return join(root, 'tide-alerts');
    },
  },
  {
    title: 'a store of a newer format',
    place: (root: string) => {
      seedStoreFile(join(root, 'tide-alerts'), 'session', 'format=3\nname=tide-alerts\n');

      return join(root, 'tide-alerts');
    },
  },
])('it prints only the two lines for $title', async (row) => {
  const ctx = setupTest();
  const folder = row.place(ctx.root);

  const injection = await ctx.read(folder, 'tide-alerts', 'claude');

  expect(injection).toBe(
    "wherewerewe: this session started or was compacted, and tide-alerts's brief is not in your context yet.\nRun: www\n",
  );
});

test('it returns null when the store folder is missing', async () => {
  const ctx = setupTest();

  const injection = await ctx.read(join(ctx.root, 'gone-away'), 'gone-away', 'claude');

  expect(injection).toBeNull();
});

test('it keeps the worst-case injection under 10,000 characters and near 1,610 bytes', async () => {
  const ctx = setupTest();
  const env = { HOME: ctx.root, XDG_STATE_HOME: ctx.root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };

  const runAsAgent = (argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => ctx.nowMs,
    });

  await seedWorstCaseStore(runAsAgent, join(ctx.root, 'wherewerewe'), 'tide-alerts', {
    taskCount: 3,
  });

  const injection = await ctx.read(
    join(ctx.root, 'wherewerewe', 'tide-alerts'),
    'tide-alerts',
    'codex',
  );

  const text = injection ?? '';

  expect({
    isUnderLimit: text.length < 10_000,
    isNearDesign:
      Buffer.byteLength(text, 'utf8') >= 1000 && Buffer.byteLength(text, 'utf8') <= 1800,
  }).toStrictEqual({ isUnderLimit: true, isNearDesign: true });
});
