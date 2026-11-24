import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { estimateTokens } from '../brief/estimate-tokens.ts';
import { runCLI } from '../run-cli.ts';
import { readBriefFigure } from '../test-utils/read-brief-figure.ts';
import { readSavedBrief } from '../test-utils/read-saved-brief.ts';
import { seedItems } from '../test-utils/seed-items.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { seedWorstCaseStore } from '../test-utils/seed-worst-case-store.ts';

function setupTest() {
  const root = createTempDir('run-write').path;
  const ownerPath = join(root, 'wherewerewe', 'tide-alerts', 'owner.tsv');
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  const run = (argv: readonly string[], env: Record<string, string>, isTerminal: boolean) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: isTerminal, stdout: isTerminal },
      now: () => {
        clock.nowMs += 1000;

        return clock.nowMs - 1000;
      },
    });

  const fixedMs = Date.parse('2026-03-10T11:43:00Z');

  const envs = {
    claude: { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    codex: { HOME: root, XDG_STATE_HOME: root, CODEX_SESSION_ID: 'c9-test' },
    none: { HOME: root, XDG_STATE_HOME: root },
  } as const;

  const runFixed = (argv: readonly string[], env: Record<string, string>) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => fixedMs,
    });

  return {
    runFixed: (host: keyof typeof envs, argv: readonly string[]) => runFixed(argv, envs[host]),

    // a session at one of every kind, with a check whose saved result differs from the one
    // written with it
    createSession: async (host: keyof typeof envs, prefix: readonly string[]) => {
      await runFixed(['init', 'tide-alerts', '--goal', 'Ship the glaze timer'], envs.claude);
      await runFixed(['attach', 'tide-alerts'], envs.codex);

      await seedItems(join(root, 'wherewerewe', 'tide-alerts'), [
        {
          id: 't-a',
          claim: 'Write the timer',
          check: `pid:${String(process.pid)}`,
          atWrite: 'alive',
          last: 'gone',
        },
        { id: 't-b', claim: 'Test the timer' },
        { id: 'w-a', kind: 'wait', claim: 'Answer from the vendor', extra: { who: 'vendor' } },
        { id: 'r-a', kind: 'rule', claim: 'Run the tests from the repo root' },
        { id: 'wh-a', kind: 'where', claim: 'A worktree for the timer' },
      ]);

      for (const argv of [
        [
          'grant',
          '--may',
          'Merge small fixes',
          '--where',
          'chat',
          '--reading',
          'Covers merges; the owner kept deploys back',
        ],
        ['decide', 'Keep the timer in one file', '--why', 'It is small'],
        ['lesson', 'l-a', 'Reseed before the e2e run', '--why', 'A stale row passed it'],
        ['promise', 'p-a', 'The cost table', '--to', 'owner', '--by', 'Friday'],
        ['words', 'w-b', 'Plain words in every reply', '--where', 'chat'],
      ]) {
        await runFixed([...prefix, ...argv], envs[host]);
      }
    },
    root,
    stateRoot: join(root, 'wherewerewe'),
    readSavedBrief: (host: 'claude' | 'codex' | null, sessionFlag: string | null, name: string) =>
      readSavedBrief(join(root, 'wherewerewe', name), { nowMs: fixedMs, sessionFlag, host }),
    runAsAgent: (argv: readonly string[]) =>
      run(argv, { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' }, false),
    runAsAgentWithPath: (argv: readonly string[], path: string) =>
      run(
        ['--session', 'tide-alerts', ...argv],
        { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: path },
        false,
      ),
    runAsOwner: (argv: readonly string[]) => run(argv, { HOME: root, XDG_STATE_HOME: root }, true),
    lockOwnerFile: () => {
      chmodSync(ownerPath, 0o444);
    },
    readOwnerFile: () => {
      const stats = statSync(ownerPath);

      return { ino: stats.ino, mode: stats.mode & 0o777, text: readFileSync(ownerPath, 'utf8') };
    },
  };
}

test('it never rewrites owner.tsv in an agent write or a read, or in a refused init, import, install, doctor and hook', async () => {
  const ctx = setupTest();

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);
  await ctx.runAsOwner(['--session', 'tide-alerts', 'say', 'Ask me first']);

  ctx.lockOwnerFile();

  const untouched = ctx.readOwnerFile();

  const accepted = [
    ['goal', 'Ship the glaze timer and its tests'],
    ['task', 't-a', 'Write it'],
    ['now', 't-a', 'Start with the parser'],
    ['wait', 'w-a', 'Answer from the vendor', '--who', 'vendor'],
    [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'the timer repo',
      '--once',
    ],
    ['rule', 'r-a', 'Run the tests from the repo root'],
    ['where', 'wt-a', 'A worktree for the timer'],
    ['lesson', 'l-a', 'Reseed before the e2e run', '--why', 'A stale row passed it'],
    ['promise', 'p-a', 'The cost table', '--to', 'owner', '--by', 'Friday'],
    ['words', 'w-b', 'Plain words in every reply', '--where', 'chat'],
    ['set', 't-a', 'Write it with tests'],
    ['task', 't-b', 'Fire the test tiles', '--note', '<a note>', '--owed'],
    ['now', 't-b', 'Load the kiln', '--note', '<a note>'],
    ['set', 't-b', '--note', '<a note>'],
    ['set', 't-b', '--no-note'],
    ['set', 't-b', 'Fire the test tiles at cone 6', '--note', '<a note>'],
    ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'],
    ['decide', 'Poll every minute', '--why', 'Too slow', '--ruled-out'],
    ['use', 'ok-a', '--for', 'merged the timer'],
    ['done', 't-a', '--evidence', 'commit 4c1d2e0'],
    ['drop', 'w-a', '--why', 'the vendor answered in chat'],
    ['drop', 'l-a', '--why', 'the seed script does it now'],
    ['done', 'p-a', '--evidence', 'cost table shared in chat'],
    ['drop', 'w-b', '--why', 'moved to AGENTS.md'],
    ['task', 't-p', 'Watch the process', '--pid', String(process.pid)],
    ['detach'],
    ['attach', 'tide-alerts'],
    [],
    ['show'],
    ['show', 'r-a'],
    ['list', 'rules'],
    ['list', 'lessons'],
    ['list', 'promises'],
    ['list', 'words'],
    ['list', 'notes'],
    ['list', 'decisions'],
    ['log'],
    ['recap'],
    ['recap', '--since', '3d'],
  ];

  const refused = [
    { argv: ['init', 'tide-alerts', '--goal', 'Ship the glaze timer'], exitCode: 3 },
    { argv: ['import', 'tide-alerts'], exitCode: 3 },
    { argv: ['install'], exitCode: 2 },
    { argv: ['doctor'], exitCode: 2 },
    { argv: ['hook', 'claude'], exitCode: 2 },
  ];

  const runs = [...accepted.map((argv) => ({ argv, exitCode: 0 })), ...refused];
  const exitCodes: number[] = [];
  const owners: unknown[] = [];

  for (const run of runs) {
    const result = await ctx.runAsAgent(['--session', 'tide-alerts', ...run.argv]);

    exitCodes.push(result.exitCode);
    owners.push(ctx.readOwnerFile());
  }

  expect({ exitCodes, owners }).toStrictEqual({
    exitCodes: runs.map((run) => run.exitCode),
    owners: runs.map(() => untouched),
  });
});

test('it runs the probe of a write with a check before it takes the lock', async () => {
  const ctx = setupTest();
  const bin = join(ctx.root, 'bin');
  const marker = join(ctx.root, 'probed');
  const folder = join(ctx.root, 'wherewerewe', 'tide-alerts');

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);

  seedStubCommand(bin, 'gh', `echo ran > "${marker}"\nexit 1`);
  seedLockFile(folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

  const result = await ctx.runAsAgentWithPath(
    ['task', 't-a', 'Write it', '--pr', 'bosunhq/bosun-api#1'],
    bin,
  );

  expect({
    exitCode: result.exitCode,
    probed: existsSync(marker),
    tasks: readFileSync(join(folder, 'items.tsv'), 'utf8').includes('t-a'),
  }).toStrictEqual({ exitCode: 3, probed: true, tasks: false });
});

test('it holds no lock while a probe runs, so a second write replies first and both land', async () => {
  const ctx = setupTest();
  const bin = join(ctx.root, 'bin');
  const started = join(ctx.root, 'probe-started');
  const folder = join(ctx.root, 'wherewerewe', 'tide-alerts');

  await ctx.runAsAgent(['init', 'tide-alerts', '--goal', 'Ship the glaze timer']);

  seedStubCommand(
    bin,
    'gh',
    `echo started > "${started}"\n/bin/sleep 1\nprintf '%s' '{"state":"OPEN","statusCheckRollup":[]}'`,
  );

  const replies: string[] = [];

  const runTracked = async (name: string, argv: readonly string[]) => {
    const result = await ctx.runAsAgentWithPath(argv, bin);

    replies.push(name);

    return result;
  };

  const slow = runTracked('slow', ['task', 't-a', 'Write it', '--pr', 'bosunhq/bosun-api#1']);

  await waitFor(() => {
    expect(existsSync(started)).toBe(true);
  });

  const quick = await runTracked('quick', ['task', 't-b', 'Draw it']);
  const first = await slow;

  const written = readFileSync(join(folder, 'items.tsv'), 'utf8');

  expect({
    exitCodes: [quick.exitCode, first.exitCode],
    replies,
    both: [written.includes('t-a\ttask'), written.includes('t-b\ttask')],
  }).toStrictEqual({ exitCodes: [0, 0], replies: ['quick', 'slow'], both: [true, true] });
});

test.each(
  (
    [
      { host: 'claude', readerHost: 'claude', prefix: [], sessionFlag: null, limit: 8000 },
      { host: 'codex', readerHost: 'codex', prefix: [], sessionFlag: null, limit: 10_000 },
      {
        host: 'none',
        readerHost: null,
        prefix: ['--session', 'tide-alerts'],
        sessionFlag: 'tide-alerts',
        limit: 20_000,
      },
    ] as const
  ).flatMap((host) =>
    (
      [
        { title: 'task', setup: [], argv: ['task', 't-new', 'One more'] },
        { title: 'wait', setup: [], argv: ['wait', 'w-new', 'Hear back', '--who', 'vendor'] },
        {
          title: 'ok',
          setup: [],
          argv: [
            'ok',
            'ok-a',
            '--quote',
            'merge it',
            '--who',
            'owner',
            '--where',
            'chat',
            '--scope',
            'the timer repo',
            '--once',
          ],
        },
        { title: 'rule', setup: [], argv: ['rule', 'r-new', 'Run from the repo root'] },
        { title: 'where', setup: [], argv: ['where', 'wh-new', 'A second worktree'] },
        { title: 'set claim', setup: [], argv: ['set', 't-a', 'Write the timer again'] },
        { title: 'set note', setup: [], argv: ['set', 't-b', '--note', 'Start with the parser'] },
        {
          title: 'set no-note',
          setup: [['set', 't-b', '--note', 'Start with the parser']],
          argv: ['set', 't-b', '--no-note'],
        },
        { title: 'now', setup: [], argv: ['now', 't-a', 'Start with the parser'] },
        { title: 'goal', setup: [], argv: ['goal', 'Ship the glaze timer and its tests'] },
        {
          title: 'grant',
          setup: [],
          argv: ['grant', '--may', 'Merge fixes', '--where', 'chat', '--reading', 'Covers merges'],
        },
        {
          title: 'grant reading',
          setup: [],
          argv: ['grant', '--reading', 'Covers merges and nothing else'],
        },
        { title: 'decide', setup: [], argv: ['decide', 'Use one file', '--why', 'It is small'] },
        { title: 'done', setup: [], argv: ['done', 't-b', '--evidence', 'commit 4c1d2e0'] },
        { title: 'drop', setup: [], argv: ['drop', 'r-a', '--why', 'No longer true'] },
        {
          title: 'use',
          setup: [
            [
              'ok',
              'ok-a',
              '--quote',
              'merge it',
              '--who',
              'owner',
              '--where',
              'chat',
              '--scope',
              'the timer repo',
              '--once',
            ],
          ],
          argv: ['use', 'ok-a', '--for', 'merged it'],
        },
        {
          title: 'lesson',
          setup: [],
          argv: ['lesson', 'l-new', 'Pin the clock', '--why', 'A test read the real time'],
        },
        {
          title: 'promise',
          setup: [],
          argv: ['promise', 'p-new', 'The e2e report', '--to', 'owner', '--by', 'Monday'],
        },
        {
          title: 'words',
          setup: [],
          argv: ['words', 'w-new', 'Short sentences', '--where', 'chat'],
        },
        {
          title: 'drop of a lesson',
          setup: [],
          argv: ['drop', 'l-a', '--why', 'It no longer holds'],
        },
        {
          title: 'done of a promise',
          setup: [],
          argv: ['done', 'p-a', '--evidence', 'cost table shared in chat'],
        },
      ] as const
    ).map((write) => ({
      host: host.host,
      readerHost: host.readerHost,
      prefix: host.prefix,
      sessionFlag: host.sessionFlag,
      limit: host.limit,
      title: write.title,
      setup: write.setup,
      argv: write.argv,
    })),
  ),
)(
  'it reports in each write reply the estimate of the brief rendered from the saved store, for $host after $title',
  async (row) => {
    const ctx = setupTest();

    await ctx.createSession(row.host, row.prefix);

    for (const argv of row.setup) {
      await ctx.runFixed(row.host, [...row.prefix, ...argv]);
    }

    const reply = await ctx.runFixed(row.host, [...row.prefix, ...row.argv]);
    const saved = await ctx.readSavedBrief(row.readerHost, row.sessionFlag, 'tide-alerts');

    expect({ exitCode: reply.exitCode, figure: readBriefFigure(reply.stdout) }).toStrictEqual({
      exitCode: 0,
      figure: { tokens: estimateTokens(saved), limit: row.limit },
    });
  },
);

test('it reports the estimate of the cut brief of a named session, with --session in its cut lines', async () => {
  const ctx = setupTest();
  const name = 'n'.repeat(24);

  await seedWorstCaseStore((argv) => ctx.runFixed('claude', argv), ctx.stateRoot, name, {
    taskCount: 29,
    isThreeByte: true,
  });

  const reply = await ctx.runFixed('claude', ['--session', name, 'task', 't-w1', 'One more']);
  const saved = await ctx.readSavedBrief('claude', name, name);

  expect({
    exitCode: reply.exitCode,
    figure: readBriefFigure(reply.stdout),
    hasCutLine: saved.includes(`more: www --session ${name} list `),
  }).toStrictEqual({
    exitCode: 0,
    figure: { tokens: estimateTokens(saved), limit: 8000 },
    hasCutLine: true,
  });
});
