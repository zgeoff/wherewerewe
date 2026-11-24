import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { runCLI } from '../run-cli.ts';
import { formatOwnerFile } from '../store/format-owner-file.ts';
import { formatPrsFile } from '../store/format-prs-file.ts';
import { readStore } from '../store/read-store.ts';
import { writeStoreFiles } from '../store/write-store-files.ts';
import type { Item } from '../types.ts';
import { seedGhAnswers } from './seed-gh-answers.ts';
import { seedGitRepo } from './seed-git-repo.ts';
import { seedJournalRow } from './seed-journal-row.ts';
import { seedStoreFile } from './seed-store-file.ts';

export interface DayNineStore {
  readonly stateRoot: string;

  // the folder a probe finds gh and git in: the only PATH of the session's env
  readonly bin: string;
  readonly env: Readonly<Record<string, string>>;
}

const decisions = [
  {
    id: 'd-7',
    ts: '2026-03-04T10:00:00Z',
    op: 'decide',
    choice: 'Read tide times in UTC and convert on the device',
    extra: 'who=agent',
  },
  {
    id: 'd-12',
    ts: '2026-03-06T10:00:00Z',
    op: 'decide',
    choice: 'Open the alert settings screen from the harbour page, never from the tab bar',
    extra: 'who=agent',
  },
  {
    id: 'd-19',
    ts: '2026-03-08T10:00:00Z',
    op: 'decide',
    choice: 'queue the alert in the job, not the request',
    extra: 'who=agent',
  },
  {
    id: 'd-20',
    ts: '2026-03-09T09:00:00Z',
    op: 'decide',
    choice: "Store each saved harbour's time zone on the harbour, never on the device",
    extra: 'who=agent',
  },
  {
    id: 'd-21',
    ts: '2026-03-09T14:00:00Z',
    op: 'decide',
    choice: 'Read low-water times from the feed, never compute them',
    extra: 'who=agent',
  },
  {
    id: 'd-22',
    ts: '2026-03-10T09:00:00Z',
    op: 'ruled-out',
    choice: 'Compute low-water times from the harmonic constants',
    extra: 'who=agent',
  },
  {
    id: 'd-23',
    ts: '2026-03-10T10:48:15Z',
    op: 'decide',
    choice: 'Retry a 503 from the tide feed 3 times, 2 s apart',
    extra: 'on=pr-api-77;who=agent',
  },
] as const;

const goal =
  'Ship tide alerts in bosun-api and bosun-app: a push alert 2 hours before low water at a saved harbour, behind the tide_alerts flag. Done when alerts-e2e passes on staging.';

// The session of brief.md's day 9: each item written through the commands at its own time, then
// the saved results the commands cannot make. With `isExampleStart`, it is the store the examples
// of commands.md start from, before the writes those examples make.
export async function seedDayNineRows(
  root: string,
  isExampleStart: boolean,
): Promise<DayNineStore> {
  const bin = join(root, 'bin');
  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test', PATH: bin };
  const stateRoot = join(root, 'wherewerewe');
  const folder = join(stateRoot, 'tide-alerts');

  mkdirSync(bin, { recursive: true });
  linkCommands(bin, ['git']);

  seedGhAnswers(bin, {
    'bosunhq/bosun-api#77': 'OPEN pending',
    'bosunhq/bosun-app#61': 'OPEN passing',
    'tidal-org/tidekit#19': 'OPEN pending',
  });

  const repo = await seedGitRepo(root);

  const simulator = Bun.spawn(['/bin/sleep', '120']);

  const run = (at: string, argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: root,
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse(at),
    });

  await run('2026-03-02T08:04:11Z', ['init', 'tide-alerts', '--goal', goal]);

  await run('2026-03-03T09:12:40Z', [
    'grant',
    ...[
      'merge the alert PRs once CI is green and every review finding is answered',
      'deploy either app to staging whenever you need to',
      'wipe or reseed the staging alerts table as often as you like',
      'open PRs on tidal-org/tidekit from our fork',
    ].flatMap((bullet) => ['--may', bullet]),
    '--not',
    'the prod database',
    '--never',
    'the prod push certificate',
    '--never',
    'publishing a tidekit release',
    '--scope',
    'in bosun-api, bosun-app and tidekit',
    '--where',
    'chat',
    '--reading',
    'covers merges in both repos on green CI with findings answered, staging deploys, the staging alerts table, tidekit PRs; kept back: prod push certificate, prod database, tidekit releases',
  ]);

  const rules = [
    ['r-api-tests', 'Run the API tests from api/; from the repo root the queue tests are skipped'],
    [
      'r-tk-fork',
      'tidekit is a fork here: pass -R tidal-org/tidekit to gh, or the PR opens on the fork',
    ],
    ['r-sim-port', 'Start the app simulator with PORT=8091; 8090 belongs to another session'],
  ] as const;

  for (const [id, claim] of rules) {
    await run('2026-03-02T10:00:00Z', ['rule', id, claim]);
  }

  if (!isExampleStart) {
    await run('2026-03-07T08:00:00Z', ['task', 't-e2e', 'Write alerts-e2e against staging']);
  }

  await run('2026-03-08T09:03:11Z', [
    'wait',
    'w-apns',
    'upload the staging push key to the vault',
    '--who',
    'owner',
  ]);

  if (!isExampleStart) {
    await run('2026-03-08T16:20:51Z', [
      'task',
      't-flag',
      'Turn on the tide_alerts flag in staging config',
      '--blocked-by',
      'w-apns',
      '--note',
      'Turn the tide_alerts flag back off in staging config before this closes: staging is shared with the harbour team, who demo on Thursday.',
      '--owed',
    ]);
  }

  await run('2026-03-09T08:00:00Z', [
    'task',
    'pr-app-61',
    'Alert settings screen: in review',
    '--pr',
    'bosunhq/bosun-app#61',
  ]);

  await run('2026-03-10T10:31:09Z', [
    'task',
    'pr-api-77',
    'Alert job retries a 503 from the tide feed; pushed 3e1f0aa',
    '--pr',
    'bosunhq/bosun-api#77',
  ]);

  await run('2026-03-10T10:31:09Z', [
    'now',
    'pr-api-77',
    'watch CI on 3e1f0aa, then request review',
  ]);

  await run('2026-03-09T10:00:00Z', [
    'task',
    'pr-tk-19',
    'tidekit: harmonic constants for harbours south of 60°S',
    '--pr',
    'tidal-org/tidekit#19',
  ]);

  await run('2026-03-09T10:05:00Z', [
    'wait',
    'w-tk',
    'review tidal-org/tidekit#19',
    '--who',
    'tidekit team',
    '--pr',
    'tidal-org/tidekit#19',
  ]);

  await run('2026-03-09T11:00:00Z', [
    'where',
    'wt-tz',
    'bosun-api worktree for the time zone fix, branch tz-fix',
    '--path',
    repo.folder,
  ]);

  await run('2026-03-09T13:00:00Z', [
    'where',
    'p-sim',
    'app simulator, pid 48211; stop it with kill 48211',
    '--pid',
    String(simulator.pid),
  ]);

  await run('2026-03-02T09:00:00Z', [
    'where',
    's-staging',
    'staging secrets live in the vault bosun-staging; never print a value',
  ]);

  await run('2026-03-10T09:58:02Z', [
    'ok',
    'ok-prod-index',
    '--quote',
    'add the harbour_id index on the prod alerts table, once, after 22:00',
    '--who',
    'owner',
    '--where',
    'chat',
    '--scope',
    'prod alerts table',
  ]);

  await run('2026-03-10T10:42:18Z', [
    'set',
    'pr-api-77',
    '--note',
    "The 503s come from the feed's hourly refresh, about 4 s long (d-23). Retry 3 times, 2 s apart: a longer backoff makes the alert miss its 2-hour window. The lint job fails on an unused import in the retry helper, not on the retry logic.",
  ]);

  if (!isExampleStart) {
    await run('2026-03-04T09:30:00Z', [
      'words',
      'w-plain',
      'Plain words in every reply; I would rather read three short sentences than one clever one',
      '--where',
      'chat',
    ]);
  }

  await run('2026-03-05T09:00:00Z', [
    'words',
    'w-small-prs',
    'Keep each PR small enough that I can review it in one sitting',
    '--where',
    'chat',
  ]);

  if (!isExampleStart) {
    await run('2026-03-07T15:20:44Z', [
      'lesson',
      'l-seed',
      'Reseed the staging alerts table before alerts-e2e',
      '--why',
      'A stale row made alerts-e2e pass on day 6 while no alert fired',
    ]);
  }

  if (!isExampleStart) {
    await run('2026-03-09T16:05:10Z', [
      'promise',
      'due-cost',
      'Cost table for the alert fan-out',
      '--to',
      'owner',
      '--by',
      'day 10, before review',
    ]);
  }

  for (const decision of decisions.filter(
    (candidate) => !isExampleStart || candidate.id !== 'd-23',
  )) {
    await seedJournalRow(folder, {
      ts: decision.ts,
      op: decision.op,
      id: decision.id,
      text: decision.choice,
      why: 'A reason',
      extra: decision.extra,
    });
  }

  await run('2026-03-10T11:02:40Z', ['goal', goal]);

  simulator.kill();

  await simulator.exited;

  seedGhAnswers(bin, {
    'bosunhq/bosun-api#77': isExampleStart ? 'OPEN pending' : 'OPEN failing',
    'bosunhq/bosun-app#61': isExampleStart ? 'OPEN passing' : 'MERGED',
    'tidal-org/tidekit#19': 'OPEN pending',
    'bosunhq/bosun-app#64': 'OPEN pending',
  });

  await seedSavedResults(folder, isExampleStart);

  return { stateRoot, bin, env: { ...env, CLAUDE_CODE_SESSION_ID: 'a1b2-test' } };
}

// What the last read saved, as the commands cannot make it: the results in `last`, the changed row
// of pr-api-77 after its next step was set, the owner notes and the pull request no item names.
async function seedSavedResults(folder: string, isExampleStart: boolean): Promise<void> {
  const read = await readStore(folder);

  if (read.kind !== 'store') {
    throw new Error('the day 9 store did not read back');
  }

  const saved: Readonly<Record<string, string>> = {
    'pr-app-61': isExampleStart ? 'OPEN passing' : 'MERGED',
    'pr-api-77': isExampleStart ? 'OPEN pending' : 'OPEN failing',
    'pr-tk-19': 'OPEN pending',
    'w-tk': 'OPEN pending',
    'wt-tz': 'clean',
    'p-sim': 'gone',
  };

  const items: Item[] = [];

  for (const item of read.store.items) {
    items.push({ ...item, last: saved[item.id] ?? item.last });
  }

  await writeStoreFiles(folder, {
    items,
    journal: [
      {
        ts: '2026-03-10T10:55:00Z',
        op: 'changed',
        id: 'pr-api-77',
        by: 'agent',
        text: 'OPEN pending -> OPEN failing',
        why: null,
        extra: null,
      },
    ],
  });

  seedStoreFile(
    folder,
    'owner.tsv',
    formatOwnerFile([
      {
        id: 'o-2',
        text: 'The reading misses tidekit: the grant covers opening PRs there, never merging them.',
        said: '2026-03-10T09:40:12Z',
        on: null,
      },
      {
        id: 'o-3',
        text: 'Use the recorded tide fixtures for e2e, not the live feed',
        said: '2026-03-10T09:41:30Z',
        on: 't-e2e',
      },
    ]),
  );

  seedStoreFile(
    folder,
    'prs.tsv',
    formatPrsFile([
      {
        ref: 'bosunhq/bosun-app#64',
        opened: '2026-03-10T08:41:30Z',
        state: 'OPEN',
        seen: '2026-03-10T11:43:04Z',
      },
    ]),
  );
}
