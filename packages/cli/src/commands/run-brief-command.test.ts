import { expect, onTestFinished, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { createGitCommit, runGit } from '@zgeoff/testing/git';
import { estimateTokens } from '../brief/estimate-tokens.ts';
import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import { runCLI } from '../run-cli.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { parseItemsFile } from '../store/parse-items-file.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { countBriefLines } from '../test-utils/count-brief-lines.ts';
import { readShellWords } from '../test-utils/read-shell-words.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedDayNineStore } from '../test-utils/seed-day-nine-store.ts';
import { seedExampleStartStore } from '../test-utils/seed-example-start-store.ts';
import { seedGhAnswers } from '../test-utils/seed-gh-answers.ts';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { seedWorstCaseStore } from '../test-utils/seed-worst-case-store.ts';

function setupTest() {
  const root = createTempDir('run-brief').path;
  const bin = join(root, 'bin');
  const stateRoot = join(root, 'wherewerewe');
  const folder = join(stateRoot, 'tide-alerts');
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  const agentEnv = {
    HOME: root,
    XDG_STATE_HOME: root,
    CLAUDE_CODE_SESSION_ID: 'a1b2-test',
    PATH: bin,
  };

  return {
    root,
    bin,
    stateRoot,
    folder,
    agentEnv,
    advance: (durationMs: number) => {
      clock.nowMs += durationMs;
    },
    run: (argv: readonly string[], env: Record<string, string> = agentEnv) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    runFrozen: (argv: readonly string[]) =>
      runCLI({
        argv,
        env: agentEnv,
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => clock.nowMs,
      }),
    readDayNine: () => {
      const text = readFileSync(
        join(import.meta.dir, '..', '..', '..', '..', 'docs', 'design', 'wherewerewe', 'brief.md'),
        'utf8',
      );

      const section = text.slice(text.indexOf('## The brief on day 9'));

      return /```text\n(?<brief>.*?)```/su.exec(section)?.groups?.['brief'] ?? '';
    },
    runClock: (env: Record<string, string>, argv: readonly string[]) => {
      const calls = { count: 0 };

      return runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => {
          calls.count += 1;

          return Date.parse('2026-03-10T11:43:40Z') + (calls.count > 2 ? 2800 : 0);
        },
      });
    },
    readItems: () => parseItemsFile(readFileSync(join(folder, 'items.tsv'), 'utf8'), '2').items,
    readChanged: () => readJournalRows(folder, (row) => row.op === 'changed'),
    readTree: () => readTreeHashes(stateRoot),
    createRepo: () => seedGitRepo(root),
  };
}

test.each([
  { title: 'Claude Code', variable: { CLAUDE_CODE_SESSION_ID: 'a1b2-test' } },
  { title: 'Codex', variable: { CODEX_SESSION_ID: 'c9-test' } },
])('it prints the day 9 brief of brief.md whole, line for line, for $title', async (row) => {
  const ctx = setupTest();

  const store = await seedDayNineStore(ctx.root);

  const env = {
    ...store.env,
    CLAUDE_CODE_SESSION_ID: '',
    WHEREWEREWE_SESSION: 'tide-alerts',
    ...row.variable,
  };

  const result = await ctx.runClock(env, []);

  expect({
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    lines: countBriefLines(result.stdout),
    bytes: Buffer.byteLength(result.stdout),
    tokens: estimateTokens(result.stdout),
  }).toStrictEqual({
    exitCode: 0,
    stdout: ctx.readDayNine(),
    stderr: '',
    lines: 60,
    bytes: 4228,
    tokens: 1410,
  });
});

test('it prints each www list example of lists-and-json.md, character for character, from the day 9 store', async () => {
  const ctx = setupTest();

  const store = await seedDayNineStore(ctx.root);

  const text = readFileSync(
    join(
      import.meta.dir,
      '..',
      '..',
      '..',
      '..',
      'docs',
      'design',
      'wherewerewe',
      'lists-and-json.md',
    ),
    'utf8',
  );

  const section = text.slice(text.indexOf('### www list'), text.indexOf('### --json'));
  const block = /```text\n(?<examples>.*?)```/su.exec(section)?.groups?.['examples'] ?? '';

  const examples = block
    .split('\n\n')
    .map((chunk) => chunk.trimEnd().split('\n'))
    .filter((lines) => lines[0]?.startsWith('$ www list '));

  const env = { ...store.env, CLAUDE_CODE_SESSION_ID: '', WHEREWEREWE_SESSION: 'tide-alerts' };
  const actual: { command: string; stdout: string }[] = [];

  for (const lines of examples) {
    const command = (lines[0] ?? '').slice('$ www '.length);

    const argv = await readShellWords(command);
    const result = await ctx.runClock(env, argv);

    actual.push({ command, stdout: result.stdout });
  }

  expect(actual).toStrictEqual(
    examples.map((lines) => ({
      command: (lines[0] ?? '').slice('$ www '.length),
      stdout: `${lines.slice(1).join('\n')}\n`,
    })),
  );
});

test("it prints each write reply of commands.md's examples, figures included, from the store the examples start from", async () => {
  const ctx = setupTest();

  const store = await seedExampleStartStore(ctx.root);

  const text = readFileSync(
    join(import.meta.dir, '..', '..', '..', '..', 'docs', 'design', 'wherewerewe', 'commands.md'),
    'utf8',
  );

  const section = text.slice(text.indexOf('Examples from the invented session:'));
  const block = /```text\n(?<examples>.*?)```/su.exec(section)?.groups?.['examples'] ?? '';

  const examples = block
    .split('\n\n')
    .map((chunk) => chunk.trimEnd().split('\n'))
    .filter((lines) => lines[0]?.startsWith('$ www '));

  const actual: { command: string; reply: string }[] = [];

  for (const lines of examples) {
    const command = (lines[0] ?? '').slice('$ www '.length);

    const argv = await readShellWords(command);

    seedGhAnswers(store.bin, {
      'bosunhq/bosun-api#77': 'OPEN pending',
      'bosunhq/bosun-app#61': argv[0] === 'done' ? 'MERGED' : 'OPEN passing',
      'tidal-org/tidekit#19': 'OPEN pending',
    });

    const result = await runCLI({
      argv,
      env: store.env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

    actual.push({ command, reply: result.stdout + result.stderr });
  }

  expect(actual).toStrictEqual(
    examples.map((lines) => ({
      command: (lines[0] ?? '').slice('$ www '.length),
      reply: `${lines.slice(1).join('\n')}\n`,
    })),
  );
});

test('it hides the next step when the item in focus changed after now_set, and prints its note whole under the hidden line', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const note = buildSpacedText(400);

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['where', 'wt-dock', 'dock map worktree', '--path', repo.folder]);
  await ctx.run(['now', 'wt-dock', 'watch the tree', '--note', note]);

  writeFileSync(join(repo.folder, 'scratch.txt'), 'dirty\n');

  const hidden = await ctx.run([]);

  const lines = hidden.stdout.split('\n');
  const start = lines.findIndex((line) => line.startsWith('  next step hidden'));
  const noteLines = lines.slice(start + 1, start + 6);

  const words = await readShellWords(
    (lines[start] ?? '').slice((lines[start] ?? '').indexOf('Run: www ') + 'Run: www '.length),
  );

  const again = await ctx.run([]);
  const fixed = await ctx.run(words.map((word) => (word === '<next step>' ? 'go on' : word)));
  const shown = await ctx.run([]);

  expect({
    hiddenLine:
      '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"',
    line: lines[start],
    noteWhole: noteLines.map((line) => line.trim()).join(' '),
    noteLineCount: noteLines.length,
    after: lines[start + 6]?.startsWith('    ') ?? false,
    hiddenAgain: again.stdout.includes(`${lines[start] ?? ''}\n`),
    fix: [fixed.exitCode, shown.stdout.includes('  next: go on\n')],
  }).toStrictEqual({
    hiddenLine:
      '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"',
    line: '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"',
    noteWhole: note,
    noteLineCount: 5,
    after: false,
    hiddenAgain: true,
    fix: [0, true],
  });
});

test('it keeps the next step hidden on each read, and shows it after the fix, when now and the change land in the same second', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await ctx.runFrozen(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.runFrozen(['where', 'wt-dock', 'dock map worktree', '--path', repo.folder]);
  await ctx.runFrozen(['now', 'wt-dock', 'watch the tree']);

  writeFileSync(join(repo.folder, 'scratch.txt'), 'dirty\n');

  const detecting = await ctx.runFrozen([]);
  const second = await ctx.runFrozen([]);
  const fixed = await ctx.runFrozen(['now', 'wt-dock', 'go on']);
  const shown = await ctx.runFrozen([]);

  const hiddenLine =
    '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"\n';

  expect([
    detecting.stdout.includes(hiddenLine),
    second.stdout.includes(hiddenLine),
    fixed.exitCode,
    shown.stdout.includes('  next: go on\n'),
  ]).toStrictEqual([true, true, 0, true]);
});

test('it hides the next step of an item whose check reads MERGED, and names that reading', async () => {
  const ctx = setupTest();

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'MERGED' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run(['now', 'pr-api-77', 'request review', '--note', 'Wait for the owner']);

  const brief = await ctx.run([]);

  const lines = brief.stdout.split('\n');
  const start = lines.findIndex((line) => line.startsWith('NOW'));

  expect(lines.slice(start, start + 3)).toStrictEqual([
    'NOW  pr-api-77 · set 0m ago · note 0m ago',
    '  next step hidden: pr-api-77 reads MERGED. Run: www now pr-api-77 "<next step>"',
    '    Wait for the owner',
  ]);
});

test('it prints the next step of an item with no change and no reading of the four', async () => {
  const ctx = setupTest();

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'OPEN passing' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run(['now', 'pr-api-77', 'request review']);

  const brief = await ctx.run([]);

  expect(brief.stdout).toInclude('  next: request review\n');
});

test('it saves nothing and says another write held the lock when the lock is held across the save', async () => {
  const ctx = setupTest();

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'OPEN passing' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'MERGED' });
  seedLockFile(ctx.folder, 'lock', `pid=${String(process.pid)} ts=${new Date().toISOString()}\n`);

  const before = await ctx.readTree();
  const brief = await ctx.run([]);
  const after = await ctx.readTree();

  expect({
    exitCode: brief.exitCode,
    secondLine: brief.stdout.split('\n')[1],
    mergedShown: brief.stdout.includes('[MERGED]'),
    unchanged: after,
  }).toStrictEqual({
    exitCode: 0,
    secondLine: '  results not saved: another write held the lock',
    mergedShown: true,
    unchanged: before,
  });
});

test.skipIf(process.getuid?.() === 0)(
  'it prints the brief and says the store is not writable when the session folder is read-only',
  async () => {
    const ctx = setupTest();

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 't-a', 'Watch the process', '--pid', String(process.pid)]);

    chmodSync(ctx.folder, 0o555);

    const brief = await ctx.run([]);

    chmodSync(ctx.folder, 0o755);

    expect({
      exitCode: brief.exitCode,
      secondLine: brief.stdout.split('\n')[1],
      row: brief.stdout.includes('  t-a         Watch the process  [alive]\n'),
    }).toStrictEqual({
      exitCode: 0,
      secondLine: '  results not saved: the store is not writable here',
      row: true,
    });
  },
);

test('it prints the brief, tags each probe unchecked and names gh missing when no gh is on the PATH', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#1']);
  await ctx.run(['task', 'pr-b', 'Second', '--pr', 'bosunhq/bosun-api#2']);

  const startedAtMs = performance.now();

  const brief = await ctx.run([]);

  const elapsedMs = performance.now() - startedAtMs;

  expect({
    exitCode: brief.exitCode,
    header: brief.stdout.split('\n')[0]?.replace(/ in [0-9.]+s/u, ' in <t>s'),
    tags: brief.stdout.split('\n').filter((line) => line.endsWith('[unchecked]')).length,
    isFast: elapsedMs < 6000,
  }).toStrictEqual({
    exitCode: 0,
    header:
      'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · 2 checks in <t>s · 2 unchecked: gh missing',
    tags: 2,
    isFast: true,
  });
});

test('it names gh not logged in in the header when gh fails authentication', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#1']);

  seedStubCommand(
    ctx.bin,
    'gh',
    "echo 'To get started with GitHub CLI, please run: gh auth login' >&2\nexit 4",
  );

  const startedAtMs = performance.now();

  const brief = await ctx.run([]);

  const elapsedMs = performance.now() - startedAtMs;

  expect([
    brief.stdout.split('\n')[0]?.replace(/ in [0-9.]+s/u, ' in <t>s'),
    brief.stdout.includes('  pr-a        First  [unchecked]\n'),
    elapsedMs < 6000,
  ]).toStrictEqual([
    'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · 1 checks in <t>s · 1 unchecked: gh not logged in',
    true,
    true,
  ]);
});

test('it starts the probes with the item in focus, then the newest tasks, not in the order of items.tsv', async () => {
  const ctx = setupTest();
  const log = join(ctx.root, 'started');
  const ids = Array.from({ length: 9 }, (_unused, index) => `pr-${String(index + 1)}`);

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  for (const [index, id] of ids.entries()) {
    await seedItem(ctx.folder, { id, check: `pr:bosunhq/bosun-api#${String(index + 1)}` });
  }

  await ctx.run(['now', 'pr-9', 'Watch the last one first']);

  writeFileSync(log, '');

  // eight probes run at once, so the ninth starts only after the first of them returns
  seedStubCommand(
    ctx.bin,
    'gh',
    `echo "$LAUNCH $3" >> "${log}"\n/bin/sleep 0.3\nprintf '%s' '{"state":"OPEN","statusCheckRollup":[]}'`,
  );

  const launches = { count: 0 };

  // each command's env is copied just before it starts, so the getter numbers the launches in order
  const env = {
    ...ctx.agentEnv,
    get LAUNCH(): string {
      launches.count += 1;

      return String(launches.count);
    },
  };

  await ctx.run([], env);

  const started = readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(' '))
    .toSorted((first, second) => Number(first[0]) - Number(second[0]))
    .map((fields) => fields.join(' '));

  expect(started).toStrictEqual(['1 9', '2 8', '3 7', '4 6', '5 5', '6 4', '7 3', '8 2', '9 1']);
});

test(
  'it prints within 6 s when gh never returns, names the timeout and kills what it started',
  async () => {
    const ctx = setupTest();
    const marker = join(ctx.root, 'child-ran-on');

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#1']);

    seedStubCommand(ctx.bin, 'gh', `/bin/sh -c '/bin/sleep 30; echo late > "${marker}"' &\nwait`);

    const startedAtMs = performance.now();

    const brief = await ctx.run([]);

    const elapsedMs = performance.now() - startedAtMs;
    const children = Bun.spawnSync(['pgrep', '-f', marker]);

    expect({
      exitCode: brief.exitCode,
      header: brief.stdout.split('\n')[0]?.replace(/ in [0-9.]+s/u, ' in <t>s'),
      tag: brief.stdout.includes('  pr-a        First  [unchecked]\n'),
      isWithinSix: elapsedMs < 6000,
      children: children.exitCode,
    }).toStrictEqual({
      exitCode: 0,
      header:
        'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · 1 checks in <t>s · 1 unchecked: timeout',
      tag: true,
      isWithinSix: true,
      children: 1,
    });
  },
  // oxlint-disable-next-line zgeoff/max-test-timeout -- 5.5 s on CI; floor: the brief stops waiting for a probe at its 5 s deadline
  { timeout: 8000 },
);

test('it loses neither write that runs while a read probes, and saves the result of the item no write touched', async () => {
  const ctx = setupTest();
  const started = join(ctx.root, 'started');

  seedGhAnswers(ctx.bin, {
    'bosunhq/bosun-api#1': 'OPEN passing',
    'bosunhq/bosun-api#2': 'OPEN passing',
  });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#1']);
  await ctx.run(['task', 'pr-b', 'Second', '--pr', 'bosunhq/bosun-api#2']);

  seedStubCommand(
    ctx.bin,
    'gh',
    `case "$5#$3" in
  'bosunhq/bosun-api#1') echo go > "${started}"; /bin/sleep 1; printf '%s' '{"state":"MERGED","statusCheckRollup":[]}' ;;
  *) printf '%s' '{"state":"OPEN","statusCheckRollup":[{"name":"unit","status":"COMPLETED","conclusion":"SUCCESS"}]}' ;;
esac`,
  );

  const reading = ctx.run([]);

  await waitFor(() => readFileSync(started));

  const rewrite = await ctx.run(['set', 'pr-a', 'First, rewritten', '--pid', String(process.pid)]);
  const added = await ctx.run(['task', 't-new', 'Added while the read probed']);
  const brief = await reading;

  const items = ctx.readItems();

  const changed = await ctx.readChanged();

  expect({
    exitCodes: [rewrite.exitCode, added.exitCode, brief.exitCode],
    ids: items.map((item) => item.id),
    rewritten: [items[0]?.claim, items[0]?.check, items[0]?.atWrite, items[0]?.last],
    saved: [items[1]?.atWrite, items[1]?.last],
    changedRows: changed.length,
  }).toStrictEqual({
    exitCodes: [0, 0, 0],
    ids: ['pr-a', 'pr-b', 't-new'],
    rewritten: ['First, rewritten', `pid:${String(process.pid)}`, 'alive', null],
    saved: ['OPEN passing', 'OPEN passing'],
    changedRows: 0,
  });
});

test('it runs each fix command of the changed rows as printed in a bound session, and the item leaves the section', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  const folder = join(ctx.root, 'plain-folder');
  const child = Bun.spawn(['/bin/sleep', '60']);

  onTestFinished(() => {
    child.kill();
  });

  mkdirSync(folder);

  await runGit(repo.folder, repo.env, ['branch', 'feature']);

  seedGhAnswers(ctx.bin, {
    'bosunhq/bosun-api#1': 'OPEN passing',
    'bosunhq/bosun-api#2': 'OPEN pending',
    'bosunhq/bosun-api#3': 'OPEN passing',
  });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-merge', 'Merge it', '--pr', 'bosunhq/bosun-api#1']);
  await ctx.run(['task', 'pr-closed', 'Close it', '--pr', 'bosunhq/bosun-api#2']);
  await ctx.run(['task', 'pr-fail', 'Fix it', '--pr', 'bosunhq/bosun-api#3']);
  await ctx.run(['where', 'w-pid', 'A process', '--pid', String(child.pid)]);
  await ctx.run(['where', 'w-branch', 'A branch', '--branch', `${repo.folder}@feature`]);
  await ctx.run(['where', 'w-path', 'A folder', '--path', folder]);

  seedGhAnswers(ctx.bin, {
    'bosunhq/bosun-api#1': 'MERGED',
    'bosunhq/bosun-api#2': 'CLOSED',
    'bosunhq/bosun-api#3': 'OPEN failing',
  });

  child.kill();

  await child.exited;
  await runGit(repo.folder, repo.env, ['branch', '-D', 'feature']);
  await createGitCommit(repo.folder, repo.env, { 'other.txt': 'other\n' });

  await Bun.$`rmdir ${folder}`.quiet();

  const fixes: string[] = [];
  const exits: number[] = [];

  for (let round = 0; round < 8; round += 1) {
    const brief = await ctx.run([]);

    const row = brief.stdout.split('\n').find((line) => line.includes(' · run: '));

    if (row === undefined) {
      break;
    }

    const command = row.slice(row.indexOf(' · run: ') + ' · run: '.length);

    const words = await readShellWords(command.slice('www '.length));

    const filled = words.map((word) => (word === '<what is true now>' ? 'Fixed again' : word));

    const result = await ctx.run(filled);

    fixes.push(`${filled[0] ?? ''} ${filled[1] ?? ''}`);
    exits.push(result.exitCode);
  }

  const last = await ctx.run([]);

  expect({
    fixes: fixes.toSorted(),
    exits,
    leftChanged: last.stdout.includes('CHANGED SINCE WRITTEN'),
  }).toStrictEqual({
    fixes: [
      'done pr-merge',
      'drop pr-closed',
      'drop w-branch',
      'drop w-path',
      'drop w-pid',
      'set pr-fail',
    ],
    exits: [0, 0, 0, 0, 0, 0],
    leftChanged: false,
  });
});

test.each([
  {
    host: 'claude',
    variable: 'CLAUDE_CODE_SESSION_ID',
    id: 'a1b2-test',
    kinds: ['show', 'waits', 'promises', 'lessons', 'decisions', 'where', 'prs'],
  },
  {
    host: 'codex',
    variable: 'CODEX_SESSION_ID',
    id: 'c9-test',
    kinds: ['show', 'promises', 'where', 'prs'],
  },
] as const)(
  'it runs the command of each cut line of a 3-byte store as printed for $host with --session, and lists every row of its kind',
  async (row) => {
    const ctx = setupTest();
    const name = 'n'.repeat(24);
    const env = { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: '', [row.variable]: row.id };

    const pullRequestRefs = Array.from(
      { length: 12 },
      (_, index) => `bosunhq/bosun-api#${String(100 + index)}`,
    );

    const rowIDs: Readonly<Record<string, readonly string[]>> = {
      waits: buildMockIDs('wait', itemCaps.wait),
      promises: buildMockIDs('prom', promiseCap),
      lessons: buildMockIDs('less', lessonCap),
      rules: buildMockIDs('rule', itemCaps.rule),
      where: buildMockIDs('here', itemCaps.where),
      words: buildMockIDs('word', wordsCap),
      decisions: ['d-1', 'd-2', 'd-3'],
      prs: pullRequestRefs,
      show: buildMockIDs('task', 30),
    };

    await seedWorstCaseStore((argv) => ctx.run(argv, ctx.agentEnv), ctx.stateRoot, name, {
      taskCount: 30,
      isThreeByte: true,
    });

    seedStoreFile(
      join(ctx.stateRoot, name),
      'prs.tsv',
      formatPrsFile(
        pullRequestRefs.map((ref) => ({
          ref,
          opened: '2026-03-10T08:43:00Z',
          state: 'OPEN' as const,
          seen: '2026-03-10T09:00:00Z',
        })),
      ),
    );

    await ctx.run(['attach', name], env);

    const brief = await ctx.run(['--session', name], env);

    const cutLines = brief.stdout
      .split('\n')
      .filter((line) =>
        /^ {2}and \d+ more(?: open tasks)?: www --session \S+ (?:list \S+|show)$/u.test(line),
      );

    const listed = await Promise.all(
      cutLines.map(async (line) => {
        const words = await readShellWords(line.slice(line.indexOf(': ') + 2));

        const kind = words.at(-1) ?? '';

        const result = await ctx.run(words.slice(1), env);

        return {
          kind,
          exitCode: result.exitCode,
          missing: (rowIDs[kind] ?? ['no row of this kind is known']).filter(
            (id) => !result.stdout.includes(id),
          ),
        };
      }),
    );

    expect({ kinds: listed.map((entry) => entry.kind), listed }).toStrictEqual({
      kinds: [...row.kinds],
      listed: row.kinds.map((kind) => ({ kind, exitCode: 0, missing: [] })),
    });
  },
);
