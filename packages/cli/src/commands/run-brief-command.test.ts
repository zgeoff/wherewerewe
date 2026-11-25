import { expect, onTestFinished, test } from 'bun:test';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { createGitCommit, runGit } from '@zgeoff/testing/git';
import { estimateTokens } from '../brief/estimate-tokens.ts';
import { pickBriefLimit } from '../brief/pick-brief-limit.ts';
import { itemCaps, lessonCap, promiseCap, wordsCap } from '../rules/item-caps.ts';
import { runCLI } from '../run-cli.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { parseItemsFile } from '../store/parse-items-file.ts';
import { readJournalRows } from '../store/read-journal-rows.ts';
import { readStore } from '../store/read-store.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { countBriefLines } from '../test-utils/count-brief-lines.ts';
import { getJsonValue } from '../test-utils/get-json-value.ts';
import { getSteeringWords } from '../test-utils/get-steering-words.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { readShellWords } from '../test-utils/read-shell-words.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedDayNineStore } from '../test-utils/seed-day-nine-store.ts';
import { seedExampleStartStore } from '../test-utils/seed-example-start-store.ts';
import { seedGhAnswers } from '../test-utils/seed-gh-answers.ts';
import { seedGitRepo } from '../test-utils/seed-git-repo.ts';
import { seedItem } from '../test-utils/seed-item.ts';
import { seedItems } from '../test-utils/seed-items.ts';
import { seedLockFile } from '../test-utils/seed-lock-file.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';
import { seedStubCommand } from '../test-utils/seed-stub-command.ts';
import { seedWorstCaseStore } from '../test-utils/seed-worst-case-store.ts';
import { readBriefFigure } from '../writes/read-brief-figure.ts';

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
    .filter((lines) => lines[0]?.startsWith('$ www list ') === true);

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

  const section = text.slice(text.indexOf('Examples from the invented session.'));
  const block = /```text\n(?<examples>.*?)```/su.exec(section)?.groups?.['examples'] ?? '';

  const examples = block
    .split('\n\n')
    .map((chunk) => chunk.trimEnd().split('\n'))
    .filter((lines) => lines[0]?.startsWith('$ www ') === true);

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

test('it hides the next step as reads dirty on the read that finds the change, as changed after it was set on the next, and prints its note whole under the hidden line', async () => {
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
    hiddenAgain: again.stdout.includes(
      '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"\n',
    ),
    fix: [fixed.exitCode, shown.stdout.includes('  next: go on\n')],
  }).toStrictEqual({
    hiddenLine:
      '  next step hidden: wt-dock changed after it was set. Run: www now wt-dock "<next step>"',
    line: '  next step hidden: wt-dock reads dirty. Run: www now wt-dock "<next step>"',
    noteWhole: note,
    noteLineCount: 5,
    after: false,
    hiddenAgain: true,
    fix: [0, true],
  });
});

test('it hides the next step as reads dirty, then as changed after it was set, and shows it after the fix, when now and the change land in the same second', async () => {
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
    detecting.stdout.includes(
      '  next step hidden: wt-dock reads dirty. Run: www now wt-dock "<next step>"\n',
    ),
    second.stdout.includes(hiddenLine),
    fixed.exitCode,
    shown.stdout.includes('  next: go on\n'),
  ]).toStrictEqual([true, true, 0, true]);
});

test('it hides the next step of an item whose check reads OPEN passing at write and MERGED after the step is set, and names that reading', async () => {
  const ctx = setupTest();

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'OPEN passing' });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
  await ctx.run(['now', 'pr-api-77', 'request review', '--note', 'Wait for the owner']);

  seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': 'MERGED' });

  const brief = await ctx.run([]);

  const lines = brief.stdout.split('\n');
  const start = lines.findIndex((line) => line.startsWith('NOW'));

  expect(lines.slice(start, start + 3)).toStrictEqual([
    'NOW  pr-api-77 · set 0m ago · note 0m ago',
    '  next step hidden: pr-api-77 reads MERGED. Run: www now pr-api-77 "<next step>"',
    '    Wait for the owner',
  ]);
});

test.each([['MERGED'], ['CLOSED']])(
  'it prints the next step of an item whose check read %s at write and reads the same now',
  async (result) => {
    const ctx = setupTest();

    seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#77': result });

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 'pr-api-77', 'Alert job retries', '--pr', 'bosunhq/bosun-api#77']);
    await ctx.run(['now', 'pr-api-77', 'request review']);

    const brief = await ctx.run([]);

    expect(brief.stdout).toInclude('  next: request review\n');
  },
);

test('it prints the next step of an item whose check read missing before the step was set', async () => {
  const ctx = setupTest();
  const gone = join(ctx.root, 'no-such-folder');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-draw', 'Draw the depth curve', '--path', gone]);
  await ctx.run(['now', 't-draw', 'Plot the curve']);

  const brief = await ctx.run([]);

  expect(brief.stdout).toInclude('  next: Plot the curve\n');
});

test('it hides the next step as reads missing on the read that finds a path gone after the step was set, and as changed after it was set on the read after', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['task', 't-draw', 'Draw the depth curve', '--path', repo.folder]);
  await ctx.run(['now', 't-draw', 'Plot the curve']);

  rmSync(repo.folder, { recursive: true, force: true });

  const finding = await ctx.run([]);
  const after = await ctx.run([]);

  expect([
    finding.stdout.includes(
      '  next step hidden: t-draw reads missing. Run: www now t-draw "<next step>"\n',
    ),
    after.stdout.includes(
      '  next step hidden: t-draw changed after it was set. Run: www now t-draw "<next step>"\n',
    ),
  ]).toStrictEqual([true, true]);
});

test('it prints the next step of an item with no change', async () => {
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

test('it names repo config in the header, with no steering word, when a checked repo defines a filter it cannot read', async () => {
  const ctx = setupTest();

  const repo = await ctx.createRepo();

  writeFileSync(join(repo.folder, '.git', 'config'), '[filter "a b"]\n\tclean = cat\n', {
    flag: 'a',
  });

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
  await ctx.run(['where', 'w-repo', 'the chart repo', '--path', join(repo.folder, 'kiln.txt')]);

  const brief = await ctx.run([]);

  const header = brief.stdout.split('\n')[0]?.replace(/ in [0-9.]+s/u, ' in <t>s') ?? '';

  expect({ header, steering: getSteeringWords(header) }).toStrictEqual({
    header:
      'tide-alerts · day 1 · Tue 2026-03-10 11:43Z · last write 0m ago · 1 checks in <t>s · 1 unchecked: repo config',
    steering: [],
  });
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

test.each([
  { host: 'claude', variables: { CLAUDE_CODE_SESSION_ID: 'a1b2-test' }, limit: 'claude' },
  { host: 'codex', variables: { CODEX_THREAD_ID: 'c9-test' }, limit: 'codex' },
  { host: 'no host', variables: {}, limit: null },
] as const)(
  'it gives in the JSON brief the limit and estimate of the text brief for $host',
  async (row) => {
    const textCtx = setupTest();
    const jsonCtx = setupTest();
    const name = 'n'.repeat(24);

    const pullRequestRefs = Array.from(
      { length: 12 },
      (_unused, index) => `bosunhq/bosun-api#${String(100 + index)}`,
    );

    const createCopy = async (ctx: ReturnType<typeof setupTest>) => {
      seedGhAnswers(
        ctx.bin,
        Object.fromEntries(pullRequestRefs.map((ref) => [ref, 'OPEN passing'])),
      );

      await seedWorstCaseStore((argv) => ctx.run(argv, ctx.agentEnv), ctx.stateRoot, name, {
        taskCount: 30,
        isThreeByte: true,
      });

      seedStoreFile(
        join(ctx.stateRoot, name),
        'prs.tsv',
        formatPrsFile(
          pullRequestRefs.map((ref, index) =>
            index < 6
              ? { ref, opened: '2026-03-10T08:43:00Z', state: 'OPEN', seen: '2026-03-10T09:00:00Z' }
              : { ref, opened: '2026-03-10T08:43:00Z', state: null, seen: null },
          ),
        ),
      );
    };

    await createCopy(textCtx);
    await createCopy(jsonCtx);

    const nowMs = Date.parse('2026-03-10T11:43:00Z');

    const read = (ctx: ReturnType<typeof setupTest>, argv: readonly string[]) =>
      runCLI({
        argv,
        env: { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: '', ...row.variables },
        cwd: '/work',
        terminal: { stdin: false, stdout: false },
        now: () => nowMs,
      });

    const printedText = await read(textCtx, ['--session', name]);
    const printedJSON = await read(jsonCtx, ['--session', name, '--json']);
    const stored = await readStore(join(jsonCtx.stateRoot, name));

    if (stored.kind !== 'store') {
      throw new Error('the seeded store does not read');
    }

    const figure = await readBriefFigure(join(jsonCtx.stateRoot, name), stored.store, {
      nowMs,
      sessionFlag: name,
      host: row.limit,
    });

    const brief = jsonSchemas.brief.parse(JSON.parse(printedJSON.stdout));

    const decided = await readJournalRows(
      join(jsonCtx.stateRoot, name),
      (journalRow) => journalRow.op === 'decide',
    );

    expect({
      exitCodes: [printedText.exitCode, printedJSON.exitCode],
      stderr: printedJSON.stderr,
      isTextCut: /^ {2}and \d+ more/mu.test(printedText.stdout),
      limit: brief.limit,
      estimate: brief.estimate,
      open: Object.fromEntries(brief.open.map((shown) => [shown.row.id, shown])),
      lessons: Object.fromEntries(brief.lessons.map((entry) => [entry.id, entry])),
      promises: Object.fromEntries(brief.promises.map((entry) => [entry.id, entry])),
      words: Object.fromEntries(brief.words.map((entry) => [entry.id, entry])),
      decisions: Object.fromEntries(brief.decisions.map((entry) => [entry.id, entry])),
      ownerNotes: Object.fromEntries(brief.ownerNotes.map((entry) => [entry.id, entry])),
      changed: Object.fromEntries(brief.changed.map((entry) => [entry.id, entry])),
      prs: Object.fromEntries(brief.prs.map((entry) => [entry.ref, entry])),
    }).toStrictEqual({
      exitCodes: [0, 0],
      stderr: printedText.stderr,
      isTextCut: true,
      limit: pickBriefLimit(row.limit),
      estimate: figure.tokens,
      open: Object.fromEntries(
        stored.store.items.map((item) => [
          item.id,
          {
            kind: item.kind,
            row: item,
            note: stored.store.notes.find((note) => note.id === item.id) ?? null,
          },
        ]),
      ),
      lessons: Object.fromEntries(stored.store.lessons.map((entry) => [entry.id, entry])),
      promises: Object.fromEntries(stored.store.promises.map((entry) => [entry.id, entry])),
      words: Object.fromEntries(stored.store.words.map((entry) => [entry.id, entry])),
      decisions: Object.fromEntries(decided.map((entry) => [entry.id, entry])),
      ownerNotes: Object.fromEntries(stored.store.ownerNotes.map((entry) => [entry.id, entry])),
      changed: {},
      prs: Object.fromEntries(
        pullRequestRefs.map((ref, index) => [
          ref,
          {
            ref,
            opened: '2026-03-10T08:43:00Z',
            state: 'OPEN',
            seen: index < 6 ? '2026-03-10T09:00:00Z' : '2026-03-10T11:43:00Z',
          },
        ]),
      ),
    });
  },
);

test('it prints the JSON brief and the stderr of the text brief when items.tsv stops reading during a probe', async () => {
  const text = setupTest();
  const json = setupTest();

  const createCopy = async (ctx: ReturnType<typeof setupTest>) => {
    const itemsPath = join(ctx.folder, 'items.tsv');

    seedGhAnswers(ctx.bin, { 'bosunhq/bosun-api#1': 'OPEN passing' });

    await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);
    await ctx.run(['task', 'pr-a', 'First', '--pr', 'bosunhq/bosun-api#1']);

    seedStubCommand(
      ctx.bin,
      'gh',
      `/bin/rm -f "${itemsPath}"; /bin/mkdir "${itemsPath}"; printf '%s' '{"state":"OPEN","statusCheckRollup":[]}'`,
    );
  };

  await createCopy(text);
  await createCopy(json);

  const printedText = await text.run([]);
  const printedJSON = await json.run(['--json']);

  expect({
    exitCode: printedJSON.exitCode,
    stderr: printedJSON.stderr,
    session: getJsonValue(JSON.parse(printedJSON.stdout), ['session']),
  }).toStrictEqual({
    exitCode: printedText.exitCode,
    stderr: printedText.stderr,
    session: 'tide-alerts',
  });
});

test('it gives in the JSON brief the estimate of the store as the read saved it, results included', async () => {
  const ctx = setupTest();
  const watched = join(ctx.root, 'watched');

  mkdirSync(watched);

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it']);

  await seedItems(
    ctx.folder,
    buildMockIDs('task', 30).map((id) => ({
      id,
      check: `path:${watched}`,
      atWrite: 'exists',
      last: 'exists',
    })),
  );

  const before = await readStore(ctx.folder);

  rmSync(watched, { recursive: true });

  const printed = await ctx.runFrozen(['--json']);
  const after = await readStore(ctx.folder);

  if (before.kind !== 'store' || after.kind !== 'store') {
    throw new Error('the seeded store does not read');
  }

  const context = {
    nowMs: Date.parse('2026-03-10T11:43:00Z'),
    sessionFlag: null,
    host: 'claude' as const,
  };

  const saved = await readBriefFigure(ctx.folder, after.store, context);
  const unsaved = await readBriefFigure(ctx.folder, before.store, context);

  expect({
    estimate: jsonSchemas.brief.parse(JSON.parse(printed.stdout)).estimate,
    last: after.store.items
      .map((item) => item.last ?? '')
      .toSorted((first, second) => first.localeCompare(second))[0],
    differsFromUnsaved: saved.tokens !== unsaved.tokens,
  }).toStrictEqual({ estimate: saved.tokens, last: 'missing', differsFromUnsaved: true });
});
