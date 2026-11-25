import { expect, test } from 'bun:test';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
import { buildWorstCaseBriefInput } from '../test-utils/build-worst-case-brief-input.ts';
import { readDesignBlock } from '../test-utils/read-design-block.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedDayNineStore } from '../test-utils/seed-day-nine-store.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import type { Grant } from '../types.ts';

function setupTest() {
  const root = createTempDir('run-goal-paste').path;
  const stateRoot = join(root, 'wherewerewe');
  const bin = join(root, 'bin');

  const agentEnv = {
    HOME: root,
    XDG_STATE_HOME: root,
    CLAUDE_CODE_SESSION_ID: 'a1b2-test',
    PATH: bin,
  };

  const ownerEnv = { HOME: root, XDG_STATE_HOME: root, PATH: bin };

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  return {
    root,
    stateRoot,
    bin,
    agentEnv,
    ownerEnv,
    run: (argv: readonly string[], env: Record<string, string> = agentEnv, isTerminal = false) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: { stdin: isTerminal, stdout: isTerminal },
        now: () => Date.parse('2026-03-10T11:43:00Z'),
      }),
    readTree: () => readTreeHashes(stateRoot),
    buildGrantArgv: (
      may: readonly string[],
      not: readonly string[],
      never: readonly string[],
      scope: string | null,
    ) => [
      'grant',
      ...may.flatMap((bullet) => ['--may', bullet]),
      ...not.flatMap((bullet) => ['--not', bullet]),
      ...never.flatMap((bullet) => ['--never', bullet]),
      ...(scope === null ? [] : ['--scope', scope]),
      '--where',
      'chat',
      '--reading',
      'covers it',
    ],

    // each word of the bullets and the scope, counted, and each word of the paste, counted
    countMissingWords: (grant: Pick<Grant, 'may' | 'not' | 'never' | 'scope'>, pasted: string) => {
      const counts = new Map<string, number>();

      for (const word of pasted.split(/\s+/u)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }

      const wanted = [...grant.may, ...grant.not, ...grant.never, grant.scope ?? '']
        .join(' ')
        .split(/\s+/u)
        .filter((word) => word !== '');

      return wanted.filter((word) => {
        const left = counts.get(word) ?? 0;

        counts.set(word, left - 1);

        return left <= 0;
      });
    },

    // the bullets and the scope whose characters do not all appear, in order, once the line breaks
    // and the indents that wrap a long bullet are taken out of the paste
    readCutBullets: (grant: Pick<Grant, 'may' | 'not' | 'never' | 'scope'>, pasted: string) => {
      const squeezed = pasted.replaceAll(/\s+/gu, '');

      return [
        ...grant.may,
        ...grant.not,
        ...grant.never,
        ...(grant.scope === null ? [] : [grant.scope]),
      ].filter((bullet) => !squeezed.includes(bullet.replaceAll(/\s+/gu, '')));
    },
    readExample: () =>
      readDesignBlock('lists-and-json.md', '### www goal --paste', 'text')
        .split('\n')
        .slice(1)
        .join('\n'),
  };
}

test('it prints the grant as a /goal text and writes nothing', async () => {
  const ctx = setupTest();

  const store = await seedDayNineStore(ctx.root);

  const marker = join(ctx.root, 'gh-ran');

  seedStubCommand(store.bin, 'gh', `echo ran > "${marker}"`);

  seedLockFile(
    join(ctx.stateRoot, 'tide-alerts'),
    'lock',
    `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`,
  );

  const before = await ctx.readTree();
  const asAgent = await ctx.run(['--session', 'tide-alerts', 'goal', '--paste'], store.env);

  const asAgentBound = await ctx.run(['goal', '--paste'], {
    ...store.env,
    WHEREWEREWE_SESSION: 'tide-alerts',
  });

  const asOwner = await ctx.run(
    ['--session', 'tide-alerts', 'goal', '--paste'],
    ctx.ownerEnv,
    true,
  );

  const after = await ctx.readTree();

  expect({
    results: [asAgent, asAgentBound, asOwner],
    unchanged: after,
    ghRan: existsSync(marker),
  }).toStrictEqual({
    results: [asAgent, asAgentBound, asOwner].map(() => ({
      exitCode: 0,
      stdout: ctx.readExample(),
      stderr: '',
    })),
    unchanged: before,
    ghRan: false,
  });
});

test('it leaves the marker of the stub gh when a read runs gh, so the marker shows a run', async () => {
  const ctx = setupTest();

  const store = await seedDayNineStore(ctx.root);

  const marker = join(ctx.root, 'gh-ran');

  seedStubCommand(store.bin, 'gh', `echo ran > "${marker}"`);

  await ctx.run(['--session', 'tide-alerts'], store.env);

  expect(existsSync(marker)).toBe(true);
});

test('it reads only the session file', async () => {
  const ctx = setupTest();

  const store = await seedDayNineStore(ctx.root);

  const folder = join(ctx.stateRoot, 'tide-alerts');

  for (const name of ['items.tsv', 'notes.tsv', 'journal.tsv']) {
    seedStoreFile(folder, name, 'not\ta\ttable\n');
  }

  const result = await ctx.run(['--session', 'tide-alerts', 'goal', '--paste'], store.env);

  expect(result).toStrictEqual({ exitCode: 0, stdout: ctx.readExample(), stderr: '' });
});

test('it refuses with a Run line to write the grant when the session has none, and prints the grant once the line is run', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  const refused = await ctx.run(['goal', '--paste']);

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const written = await ctx.run(
    buildFilledRunArgv(line, {
      '<what the owner allows, in their words>': 'water the beds',
      '<where>': 'chat',
      '<what they cover; what the owner kept back>': 'covers watering',
    }),
  );

  const pasted = await ctx.run(['goal', '--paste']);

  expect({ refused, written: written.exitCode, pasted }).toStrictEqual({
    refused: {
      exitCode: 3,
      stdout: '',
      stderr: `www: refused: tide-alerts has no grant to print.\nRun: www grant --may "<what the owner allows, in their words>" --where <where> --reading "<what they cover; what the owner kept back>"\n`,
    },
    written: 0,
    pasted: {
      exitCode: 0,
      stdout:
        '  may    • water the beds\nRun www --session tide-alerts and deliver all the work in it.\n',
      stderr: '',
    },
  });
});

test('it exits as every read does on a store it cannot read', async () => {
  const ctx = setupTest();

  const noSession = await ctx.run(['--session', 'tide-alerts', 'goal', '--paste']);
  const noSessionBrief = await ctx.run(['--session', 'tide-alerts']);

  seedFormat1Store(ctx.stateRoot, 'old-notes');

  seedStoreFile(
    join(ctx.stateRoot, 'handwork'),
    'session',
    'name=handwork\ngoal=x\nstarted=2026-04-06T09:00:00Z\nformat=0-by-hand\n',
  );

  seedStoreFile(join(ctx.stateRoot, 'future'), 'session', 'format=3\n');
  seedStoreFile(join(ctx.stateRoot, 'bent'), 'session', 'format=2\nname=bent\nstarted=yesterday\n');

  const cases = [];

  for (const name of ['old-notes', 'handwork', 'future', 'bent']) {
    const pasted = await ctx.run(['--session', name, 'goal', '--paste']);
    const brief = await ctx.run(['--session', name]);

    cases.push({ name, pasted, brief });
  }

  expect({
    noSession,
    cases: cases.map((entry) => ({
      name: entry.name,
      exitCode: entry.pasted.exitCode,
      sameAsBrief: entry.pasted.stderr === entry.brief.stderr,
    })),
  }).toStrictEqual({
    noSession: { ...noSessionBrief, exitCode: 4 },
    cases: [
      { name: 'old-notes', exitCode: 5, sameAsBrief: true },
      { name: 'handwork', exitCode: 5, sameAsBrief: true },
      { name: 'future', exitCode: 5, sameAsBrief: true },
      { name: 'bent', exitCode: 3, sameAsBrief: true },
    ],
  });
});

test.each([
  { layout: 'wide-bullets' as const },
  { layout: 'long-bullet' as const },
  { layout: 'long-bullet-no-scope' as const },
])(
  'it prints the widest grant the session parser accepts in under 1,100 characters, for the $layout layout',
  async (row) => {
    const ctx = setupTest();
    const name = 'a'.repeat(24);

    const grant = buildWorstCaseBriefInput({ host: 'claude', taskCount: 0, grant: row.layout })
      .session.grant;

    await ctx.run(['init', name, '--goal', 'Ship it']);

    const written = await ctx.run(
      ctx.buildGrantArgv(
        grant?.may ?? [],
        grant?.not ?? [],
        grant?.never ?? [],
        grant?.scope ?? null,
      ),
    );

    const pasted = await ctx.run(['goal', '--paste']);

    expect({
      written: written.exitCode,
      exitCode: pasted.exitCode,
      isWithinCodePoints: Array.from(pasted.stdout, (character) => character).length <= 1100,
      isWithinUnits: pasted.stdout.length <= 4000,
    }).toStrictEqual({ written: 0, exitCode: 0, isWithinCodePoints: true, isWithinUnits: true });
  },
);

test('it prints a grant of 700 astral characters in under 1,100 code points and 4,000 UTF-16 units', async () => {
  const ctx = setupTest();
  const name = 'a'.repeat(24);
  const astral = '\u{1F30A}';

  await ctx.run(['init', name, '--goal', 'Ship it']);

  const written = await ctx.run(
    ctx.buildGrantArgv(
      [astral.repeat(80), astral.repeat(80), astral.repeat(80), astral.repeat(80)],
      [astral.repeat(80), astral.repeat(80), astral.repeat(80), astral.repeat(40)],
      [astral.repeat(60)],
      astral.repeat(40),
    ),
  );

  const pasted = await ctx.run(['goal', '--paste']);

  expect({
    written: written.exitCode,
    exitCode: pasted.exitCode,
    isWithinCodePoints: Array.from(pasted.stdout, (character) => character).length <= 1100,
    isWithinUnits: pasted.stdout.length <= 4000,
  }).toStrictEqual({ written: 0, exitCode: 0, isWithinCodePoints: true, isWithinUnits: true });
});

test.each([
  { layout: 'wide-bullets' as const },
  { layout: 'long-bullet' as const },
  { layout: 'long-bullet-no-scope' as const },
])(
  'it prints every character of each bullet and the scope uncut, for the $layout layout',
  async (row) => {
    const ctx = setupTest();
    const name = 'a'.repeat(24);

    const grant = buildWorstCaseBriefInput({ host: 'claude', taskCount: 0, grant: row.layout })
      .session.grant;

    await ctx.run(['init', name, '--goal', 'Ship it']);

    await ctx.run(
      ctx.buildGrantArgv(
        grant?.may ?? [],
        grant?.not ?? [],
        grant?.never ?? [],
        grant?.scope ?? null,
      ),
    );

    const pasted = await ctx.run(['goal', '--paste']);

    expect({
      exitCode: pasted.exitCode,
      cut: ctx.readCutBullets(
        {
          may: grant?.may ?? [],
          not: grant?.not ?? [],
          never: grant?.never ?? [],
          scope: grant?.scope ?? null,
        },
        pasted.stdout,
      ),
    }).toStrictEqual({ exitCode: 0, cut: [] });
  },
);

test('it prints each word of an ordinary grant, in order, with none cut or joined', async () => {
  const ctx = setupTest();
  const name = 'tide-alerts';

  await ctx.run(['init', name, '--goal', 'Ship it']);

  await ctx.run(
    ctx.buildGrantArgv(
      ['read every file in the chart repo', 'run the unit tests and the linter'],
      ['push to a shared branch'],
      ['delete a tag'],
      'the chart repo',
    ),
  );

  const pasted = await ctx.run(['goal', '--paste']);

  expect(
    ctx.countMissingWords(
      {
        may: ['read every file in the chart repo', 'run the unit tests and the linter'],
        not: ['push to a shared branch'],
        never: ['delete a tag'],
        scope: 'the chart repo',
      },
      pasted.stdout,
    ),
  ).toStrictEqual([]);
});
