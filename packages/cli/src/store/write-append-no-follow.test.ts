import { expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import type { HookPayloadSpec } from '../test-utils/build-hook-payload.ts';
import { buildHookPayload } from '../test-utils/build-hook-payload.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { writeAppendNoFollow, writeAppendNoFollowAsync } from './write-append-no-follow.ts';

type Step =
  | { readonly kind: 'agent'; readonly argv: readonly string[]; readonly id?: string }
  | { readonly kind: 'owner'; readonly argv: readonly string[] }
  | { readonly kind: 'hook'; readonly id: string; readonly spec: HookPayloadSpec }
  | { readonly kind: 'payload'; readonly text: string }
  | { readonly kind: 'file'; readonly path: string; readonly text: string };

// A link at a store path: `copy` moves what is there to the outside folder and links to it, so a
// read still finds it; `empty` links to a new empty folder there; `dangling` links to a path there
// that does not exist yet.
interface Plant {
  readonly path: string;
  readonly target: 'copy' | 'empty' | 'dangling';
}

function setupTest() {
  const root = createTempDir('write-append-no-follow').path;
  const stateRoot = join(root, 'state', 'wherewerewe');
  const outside = join(root, 'outside');
  const agentID = 'a1b2-test';

  mkdirSync(join(root, 'home'));
  mkdirSync(outside);

  const runStep = (step: Step) => {
    const env = { HOME: join(root, 'home'), XDG_STATE_HOME: join(root, 'state') };
    const base = { cwd: '/work', now: () => Date.parse('2026-03-10T11:43:00Z') };

    if (step.kind === 'file') {
      writeFileSync(join(stateRoot, step.path), step.text);

      return Promise.resolve(null);
    }

    if (step.kind === 'hook' || step.kind === 'payload') {
      return runCLI({
        ...base,
        argv: ['hook', 'claude'],
        env,
        terminal: { stdin: false, stdout: false },
        stdin: step.kind === 'hook' ? buildHookPayload('claude', step.id, step.spec) : step.text,
      });
    }

    const isOwner = step.kind === 'owner';
    const id = step.kind === 'agent' ? (step.id ?? agentID) : agentID;

    return runCLI({
      ...base,
      argv: step.argv,
      env: isOwner ? env : { ...env, CLAUDE_CODE_SESSION_ID: id },
      terminal: { stdin: isOwner, stdout: isOwner },
    });
  };

  return {
    root,
    outside,

    // the session the store starts with, and the first SessionStart of its bound agent session
    started: [
      { kind: 'agent', argv: ['init', 'tide-alerts', '--goal', 'Ship it'] },
      { kind: 'hook', id: agentID, spec: { event: 'SessionStart' } },
    ] satisfies Step[],

    // the steps, each allowed to throw, since a write that meets a planted link stops
    runSteps: async (steps: readonly Step[]) => {
      for (const step of steps) {
        await runStep(step).catch(() => null);
      }
    },

    plantLink: (plant: Plant) => {
      const path = join(stateRoot, plant.path);
      const target = join(outside, plant.path.replaceAll('/', '_'));

      if (plant.target === 'copy') {
        cpSync(path, target, { recursive: true });
      } else if (plant.target === 'empty') {
        mkdirSync(target);
      }

      rmSync(path, { recursive: true, force: true });
      symlinkSync(target, path);
    },
    readOutside: () => readTreeHashes(outside),
    readRootNames: () => readdirSync(root).toSorted(),
  };
}

test.each([
  {
    title: 'the journal, for an agent write',
    plant: { path: 'tide-alerts/journal.tsv', target: 'copy' },
    steps: [{ kind: 'agent', argv: ['task', 't-x', 'planted text'] }],
  },
  {
    title: 'the journal, for an owner note',
    plant: { path: 'tide-alerts/journal.tsv', target: 'copy' },
    steps: [{ kind: 'owner', argv: ['say', '--session', 'tide-alerts', 'planted text'] }],
  },
  {
    title: 'the session folder, for an agent write',
    plant: { path: 'tide-alerts', target: 'copy' },
    steps: [{ kind: 'agent', argv: ['task', 't-x', 'planted text'] }],
  },
  {
    title: 'the bindings folder, for an attach',
    plant: { path: '.bindings', target: 'copy' },
    steps: [{ kind: 'agent', argv: ['attach', 'tide-alerts'], id: 'c3d4-other' }],
  },
  {
    title: 'the gate folder, for a SessionStart',
    plant: { path: '.gate', target: 'empty' },
    steps: [{ kind: 'hook', id: 'a1b2-test', spec: { event: 'SessionStart' } }],
  },
  {
    title: 'the gate lock, for a SessionStart',
    plant: { path: '.gate/claude-a1b2-test.lock', target: 'dangling' },
    steps: [{ kind: 'hook', id: 'a1b2-test', spec: { event: 'SessionStart' } }],
  },
  {
    title: 'the hook log, for a payload the hooks do not use',
    plant: { path: 'hook-errors.log', target: 'dangling' },
    steps: [{ kind: 'payload', text: '{}' }],
  },
  {
    title: 'the held mark, for the hold fault',
    plant: { path: 'hook-held', target: 'dangling' },
    steps: [
      { kind: 'file', path: 'hook-fault', text: 'hold' },
      { kind: 'hook', id: 'a1b2-test', spec: { event: 'SessionStart' } },
    ],
  },
  {
    title: "doctor's probe file, for www doctor",
    plant: { path: `.doctor-probe-${String(process.pid)}`, target: 'dangling' },
    steps: [{ kind: 'owner', argv: ['doctor'] }],
  },
] satisfies { title: string; plant: Plant; steps: Step[] }[])(
  'it writes nothing outside the store through a link planted at $title',
  async (row) => {
    const ctx = setupTest();

    await ctx.runSteps(ctx.started);

    ctx.plantLink(row.plant);

    const before = await ctx.readOutside();

    await ctx.runSteps(row.steps);

    const after = await ctx.readOutside();

    expect(after).toStrictEqual(before);
  },
);

test.each(['claude', 'codex'] as const)(
  'it writes nothing outside the store for a %s hook whose session id climbs out of it',
  async (harness) => {
    const ctx = setupTest();

    await ctx.runSteps(ctx.started.slice(0, 1));

    const climbing = 'x/../../../../escape';

    const specs: HookPayloadSpec[] = [
      { event: 'PostToolUse', command: 'www attach tide-alerts', output: 'Bound' },
      { event: 'SessionStart' },
    ];

    for (const spec of specs) {
      await runCLI({
        argv: ['hook', harness],
        env: { HOME: join(ctx.root, 'home'), XDG_STATE_HOME: join(ctx.root, 'state') },
        cwd: '/work',
        now: () => Date.parse('2026-03-10T11:43:00Z'),
        terminal: { stdin: false, stdout: false },
        stdin: buildHookPayload(harness, climbing, spec),
      });
    }

    expect(ctx.readRootNames()).toStrictEqual(['home', 'outside', 'state']);
  },
);

test('it appends to a plain file and makes a missing one', async () => {
  const ctx = setupTest();
  const path = join(ctx.outside, 'rows.tsv');

  writeAppendNoFollow(path, 'one\n');

  await writeAppendNoFollowAsync(path, 'two\n');

  const text = await Bun.file(path).text();

  expect(text).toBe('one\ntwo\n');
});

test('it refuses a link at the name, for both appends', async () => {
  const ctx = setupTest();
  const target = join(ctx.outside, 'target');
  const link = join(ctx.outside, 'link');

  symlinkSync(target, link);

  expect(() => {
    writeAppendNoFollow(link, 'row\n');
  }).toThrow(/ELOOP|symbolic link/u);

  const refused = await writeAppendNoFollowAsync(link, 'row\n').then(
    () => null,
    (error: unknown) => error,
  );

  expect(refused).toBeInstanceOf(Error);
  expect(existsSync(target)).toBe(false);
});
