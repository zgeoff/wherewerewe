import { expect, test } from 'bun:test';
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';
import { runCLI } from '../run-cli.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
import { readShellWords } from '../test-utils/read-shell-words.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedFormat1Store } from '../test-utils/seed-format-1-store.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('refusals').path;
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };
  const stateRoot = join(root, 'wherewerewe');
  const snapshot = join(createTempDir('refusals-snapshot').path, 'wherewerewe');

  return {
    stateRoot,

    // Each Run line replays on its own copy of the store as the refused command found it.
    writeSnapshot: () => {
      if (existsSync(stateRoot)) {
        cpSync(stateRoot, snapshot, { recursive: true });
      }
    },
    restoreStore: () => {
      rmSync(stateRoot, { recursive: true, force: true });

      if (existsSync(snapshot)) {
        cpSync(snapshot, stateRoot, { recursive: true });
      }
    },
    agentEnv: { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    run: (
      argv: readonly string[],
      env: Record<string, string | undefined>,
      terminal: { stdin: boolean; stdout: boolean } | null = null,
    ) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        terminal: terminal ?? { stdin: false, stdout: false },
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    readTree: () => readTreeHashes(join(root, 'wherewerewe')),
    readListing: (): string[] =>
      existsSync(stateRoot)
        ? readdirSync(stateRoot, { recursive: true, encoding: 'utf8' }).toSorted()
        : [],
  };
}

test.each([
  {
    title: 'a claim over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-e2e', 'c'.repeat(152)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the claim is 152 characters, and the limit is 120. Write what is true now, and put the detail in its note with --note.\nRun: www task t-e2e "<claim of at most 120 characters>"\n',
    fills: [{ '<claim of at most 120 characters>': 'A short claim' }],
  },
  {
    title: 'a next step over its limit',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['now', 't-a', 'n'.repeat(121)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the next step is 121 characters, and the limit is 120. Write what is true now, and put the detail in its note with --note.\nRun: www now t-a "<next step of at most 120 characters>"\n',
    fills: [{ '<next step of at most 120 characters>': 'go' }],
  },
  {
    title: 'a goal over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['goal', 'g'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the goal is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www goal "<goal of at most 200 characters>"\n',
    fills: [{ '<goal of at most 200 characters>': 'Ship more' }],
  },
  {
    title: 'an init goal over its limit',
    setup: [],
    files: [],
    argv: ['init', 'new-notes', '--goal', 'g'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the goal is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www init new-notes --goal "<goal of at most 200 characters>"\n',
    fills: [{ '<goal of at most 200 characters>': 'Ship more' }],
  },
  {
    title: 'evidence over its limit',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['done', 't-a', '--evidence', 'e'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the evidence is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www done t-a --evidence "<evidence of at most 200 characters>"\n',
    fills: [{ '<evidence of at most 200 characters>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a reason over its limit',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['drop', 't-a', '--why', 'r'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the reason is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www drop t-a --why "<reason of at most 200 characters>"\n',
    fills: [{ '<reason of at most 200 characters>': 'stopped' }],
  },
  {
    title: 'a who over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['wait', 'w-a', 'Answer', '--who', 'w'.repeat(17)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the who is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.\nRun: www wait w-a Answer --who "<who of at most 16 characters>"\n',
    fills: [{ '<who of at most 16 characters>': 'owner' }],
  },
  {
    title: 'a text with a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['rule', 'r-sim-port', 'a\tb'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www rule r-sim-port "<one line>"\n',
    fills: [{ '<one line>': 'Start the simulator with PORT=8091' }],
  },
  {
    title: 'an empty claim',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', ''],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the claim is empty.\nRun: www task t-a "<claim>"\n',
    fills: [{ '<claim>': 'Write it' }],
  },
  {
    title: 'evidence of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['done', 't-a', '--evidence', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the evidence is empty.\nRun: www done t-a --evidence "<evidence>"\n',
    fills: [{ '<evidence>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a reason of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['drop', 't-a', '--why', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the reason is empty.\nRun: www drop t-a --why "<reason>"\n',
    fills: [{ '<reason>': 'Not needed' }],
  },
  {
    title: 'a goal of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['goal', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the goal is empty.\nRun: www goal "<goal>"\n',
    fills: [{ '<goal>': 'Ship tide alerts' }],
  },
  {
    title: 'a next step of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['now', 't-a', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the next step is empty.\nRun: www now t-a "<next step>"\n',
    fills: [{ '<next step>': 'push the fix' }],
  },
  {
    title: 'a full set of tasks',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
      ['task', 't-b', 'x'],
      ['task', 't-c', 'x'],
      ['task', 't-d', 'x'],
      ['task', 't-e', 'x'],
      ['task', 't-f', 'x'],
    ],
    files: [],
    argv: ['task', 't-g', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the brief holds 6 of 6 tasks. Close one, or replace one with www set.\nRun: www done t-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a full set of waits',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['wait', 'w-a', 'x', '--who', 'owner'],
      ['wait', 'w-b', 'x', '--who', 'owner'],
      ['wait', 'w-c', 'x', '--who', 'owner'],
      ['wait', 'w-d', 'x', '--who', 'owner'],
    ],
    files: [],
    argv: ['wait', 'w-e', 'x', '--who', 'owner'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the brief holds 4 of 4 waits. Close one, or replace one with www set.\nRun: www done w-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a full set of where items',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['where', 'wt-a', 'x'],
      ['where', 'wt-b', 'x'],
      ['where', 'wt-c', 'x'],
      ['where', 'wt-d', 'x'],
    ],
    files: [],
    argv: ['where', 'wt-e', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the brief holds 4 of 4 where items. Close one, or replace one with www set.\nRun: www done wt-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a full set of rules',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'x'],
      ['rule', 'r-b', 'x'],
      ['rule', 'r-c', 'x'],
      ['rule', 'r-d', 'x'],
      ['rule', 'r-e', 'x'],
    ],
    files: [],
    argv: ['rule', 'r-f', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the brief holds 5 of 5 rules. Close one, or replace one with www set.\nRun: www drop r-a --why "<reason>"\n',
    fills: [{ '<reason>': 'stopped' }],
  },
  {
    title: 'done with no evidence',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['done', 't-a'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: done needs evidence a reader can open, such as a PR, a commit or a test run. For work you stopped, use drop.\nRun: www done t-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'drop with no reason',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['drop', 't-a'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: drop needs a reason.\nRun: www drop t-a --why "<reason>"\n',
    fills: [{ '<reason>': 'stopped' }],
  },
  {
    title: 'a wait with no who',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['wait', 'w-apns', 'upload the staging push key'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a wait names who it waits on.\nRun: www wait w-apns "upload the staging push key" --who "<who>"\n',
    fills: [{ '<who>': 'owner' }],
  },
  {
    title: 'a who with a semicolon and an equals sign',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['wait', 'w-a', 'Answer', '--who', 'a;b=c'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: --who cannot hold ; or =.\nRun: www wait w-a Answer --who a,b,c\n',
    fills: [{}],
  },
  {
    title: 'set on an id that is not open',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['set', 't-b', 'Fresh claim'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: no open item t-b. Open items: t-a.\nRun: www task t-b "Fresh claim"\n',
    fills: [{}],
  },
  {
    title: 'set with a note and --owed on an id that is not open',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['set', 't-b', '--note', 'Stop the simulator first', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item t-b. Open items: t-a.\nRun: www task t-b "<claim>" --note "Stop the simulator first" --owed\n',
    fills: [{ '<claim>': 'Fresh claim' }],
  },
  {
    title: 'set with --no-note on an id that is not open',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['set', 't-b', '--no-note'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: no open item t-b. Open items: t-a.\nRun: www task t-b "<claim>"\n',
    fills: [{ '<claim>': 'Fresh claim' }],
  },
  {
    title: 'now on a near miss of an open id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['now', 't-x', 'go'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: no open item t-x. Open items: t-a.\nRun: www now t-a go\n',
    fills: [{}],
  },
  {
    title: 'done on an id far from every open id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 'zz-open', 'x'],
    ],
    files: [],
    argv: ['done', 'missing-long-id', '--evidence', 'e'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item missing-long-id. Open items: zz-open.\nRun: www done <open id> --evidence e\n',
    fills: [{ '<open id>': 'zz-open' }],
  },
  {
    title: 'done with nothing open (nothing to fill the open id with)',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['done', 't-a', '--evidence', 'e'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item t-a. Open items: none.\nRun: www done <open id> --evidence e\n',
    fills: [],
  },
  {
    title: 'a new item on a closed id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
      ['done', 't-a', '--evidence', 'e'],
    ],
    files: [],
    argv: ['task', 't-a', 'Again'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: t-a closed on day 1. Pick a new id.\nRun: www task <new id> Again\n',
    fills: [{ '<new id>': 't-new' }],
  },
  {
    title: 'a task on an open rule',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'x'],
    ],
    files: [],
    argv: ['task', 'r-a', 'New text'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: r-a is a rule. Change its text with set, or pick a new id.\nRun: www set r-a "New text"\n',
    fills: [{}],
  },
  {
    title: 'an id with a capital and a space',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 'T One', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.\nRun: www task t-one x\n',
    fills: [{}],
  },
  {
    title: 'an id that no repair makes valid',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 'd-4', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.\nRun: www task <new id> x\n',
    fills: [{ '<new id>': 't-d4' }],
  },
  {
    title: 'a credential in a claim on a new id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 's-staging', 'token ghp_abc123'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www where s-staging "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'the vault bosun-staging' }],
  },
  {
    title: 'a credential in a claim that carries a note and --owed',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', `token ghp_${'a'.repeat(6)}`, '--note', 'Rotate it Friday.', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www where t-a "<where the secret lives>" --note "Rotate it Friday." --owed\n',
    fills: [{ '<where the secret lives>': 'the vault bosun-staging' }],
  },
  {
    title: 'a credential in a set of an open task',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['set', 't-a', 'token ghp_abc123'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www where <new id> "<where the secret lives>"\n',
    fills: [{ '<new id>': 's-staging', '<where the secret lives>': 'the vault bosun-staging' }],
  },
  {
    title: 'a credential in a goal',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['goal', 'use ghp_abc123'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www goal "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'Ship it' }],
  },
  {
    title: 'a credential in evidence',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['done', 't-a', '--evidence', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www done t-a --evidence "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'commit 4c1d2e0' }],
  },
  {
    title: 'two checks',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'x', '--pr', 'acme/tool#1', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an item takes one check. Split it into two items.\nRun: www task t-a x --pr acme/tool#1\n',
    fills: [{}],
  },
  {
    title: 'a malformed --pr',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'x', '--pr', 'nope'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --pr takes <owner>/<repo>#<number>, such as bosunhq/bosun-api#77.\nRun: www task t-a x --pr <owner>/<repo>#<number>\n',
    fills: [{ '<owner>/<repo>#<number>': 'acme/tool#7' }],
  },
  {
    title: 'a malformed --branch',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--branch', 'nopath'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --branch takes <absolute repo path>@<branch>, such as /home/sam/src/bosun-api@tz-fix.\nRun: www where wt-a x --branch <absolute repo path>@<branch>\n',
    fills: [{ '<absolute repo path>@<branch>': '/srv/app@fix' }],
  },
  {
    title: 'a malformed --pid',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--pid', 'abc'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --pid takes a process id, such as 48211.\nRun: www where wt-a x --pid <process id>\n',
    fills: [{ '<process id>': '4242' }],
  },
  {
    title: 'an empty --path',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--path', ''],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --path takes an absolute path.\nRun: www where wt-a x --path <absolute path>\n',
    fills: [{ '<absolute path>': '/srv/app' }],
  },
  {
    title: 'a relative --path',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--path', 'src/app'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --path takes an absolute path.\nRun: www where wt-a x --path /work/src/app\n',
    fills: [{}],
  },
  {
    title: 'a relative --branch',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--branch', 'src@fix'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --branch takes an absolute path.\nRun: www where wt-a x --branch /work/src@fix\n',
    fills: [{}],
  },
  {
    title: 'a path with a newline',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--path', '/tmp/first\nsecond'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www where wt-a x --path "<one line>"\n',
    fills: [{ '<one line>': '/srv/app' }],
  },
  {
    title: 'a branch whose path holds a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['where', 'wt-a', 'x', '--branch', '/tmp/first\tsecond@fix'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www where wt-a x --branch "<one line>"\n',
    fills: [{ '<one line>': '/srv/app@fix' }],
  },
  {
    title: 'a claim of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the claim is empty.\nRun: www task t-a "<claim>"\n',
    fills: [{ '<claim>': 'Write it' }],
  },
  {
    title: 'evidence of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['done', 't-a', '--evidence', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the evidence is empty.\nRun: www done t-a --evidence "<evidence>"\n',
    fills: [{ '<evidence>': 'commit 4c1d2e0' }],
  },
  {
    title: 'a reason of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['drop', 't-a', '--why', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the reason is empty.\nRun: www drop t-a --why "<reason>"\n',
    fills: [{ '<reason>': 'Not needed' }],
  },
  {
    title: 'a goal of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['goal', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the goal is empty.\nRun: www goal "<goal>"\n',
    fills: [{ '<goal>': 'Ship tide alerts' }],
  },
  {
    title: 'a next step of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['now', 't-a', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the next step is empty.\nRun: www now t-a "<next step>"\n',
    fills: [{ '<next step>': 'push the fix' }],
  },
  {
    title: 'a --who typed twice, the last holding a separator',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['wait', 'w-a', 'Answer', '--who', 'old', '--who', 'new=team'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: --who cannot hold ; or =.\nRun: www wait w-a Answer --who new,team\n',
    fills: [{}],
  },
  {
    title: 'a task with a check on an open rule',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'x'],
    ],
    files: [],
    argv: ['task', 'r-a', 'new note', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: r-a is a rule. Change its text with set, or pick a new id.\nRun: www set r-a "new note"\n',
    fills: [{}],
  },
  {
    title: 'a wait with a --who on an open task',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
    ],
    files: [],
    argv: ['wait', 't-a', 'new note', '--who', 'owner', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: t-a is a task. Change its text with set, or pick a new id.\nRun: www set t-a "new note" --pid 5\n',
    fills: [{}],
  },
  {
    title: 'a task with a note and --owed on an open rule',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'x'],
    ],
    files: [],
    argv: ['task', 'r-a', 'New text', '--note', 'Keep the port free.', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: r-a is a rule. Change its text with set, or pick a new id.\nRun: www set r-a "New text" --note "Keep the port free." --owed\n',
    fills: [{}],
  },
  {
    title: 'a rule with a check, a note and --owed',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['rule', 'r-a', 'x', '--pid', '5', '--note', 'Hold the port.', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a rule has no check. Make the checked thing a where item.\nRun: www where <new id> x --pid 5 --note "Hold the port." --owed\n',
    fills: [{ '<new id>': 'wt-a' }],
  },
  {
    title: 'a rule with a check',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['rule', 'r-a', 'x', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a rule has no check. Make the checked thing a where item.\nRun: www where <new id> x --pid 5\n',
    fills: [{ '<new id>': 'wt-a' }],
  },
  {
    title: 'a set of a rule with a check',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'x'],
    ],
    files: [],
    argv: ['set', 'r-a', 'y', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a rule has no check. Make the checked thing a where item.\nRun: www where <new id> y --pid 5\n',
    fills: [{ '<new id>': 'wt-a' }],
  },
  {
    title: 'a --blocked-by near an open wait',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'x'],
      ['wait', 'w-apns', 'x', '--who', 'owner'],
    ],
    files: [],
    argv: ['task', 't-flag', 'x', '--blocked-by', 'w-apn'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --blocked-by w-apn names no open task or wait. Open: t-a, w-apns.\nRun: www task t-flag x --blocked-by w-apns\n',
    fills: [{}],
  },
  {
    title: 'a --blocked-by far from every open id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 'zz-open', 'x'],
    ],
    files: [],
    argv: ['task', 't-flag', 'x', '--blocked-by', 'missing-thing'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --blocked-by missing-thing names no open task or wait. Open: zz-open.\nRun: www task t-flag x\n',
    fills: [{}],
  },
  {
    title: 'an init of a session that exists, with an agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['init', 'tide-alerts', '--goal', 'Other'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: session tide-alerts exists. Bind this agent session to it.\nRun: www attach tide-alerts\n',
    fills: [{}],
  },
  {
    title:
      'an init of a session that exists, with no agent id (its Run line runs in an agent session)',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['init', 'tide-alerts', '--goal', 'Other'],
    env: 'shell',
    replayEnv: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: session tide-alerts exists. Bind this agent session to it.\nRun: www attach tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'an init with no goal',
    setup: [],
    files: [],
    argv: ['init', 'new-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a session needs its goal.\nRun: www init new-notes --goal "<what done means>"\n',
    fills: [{ '<what done means>': 'Ship it' }],
  },
  {
    title: 'an init with a bad session name',
    setup: [],
    files: [],
    argv: ['init', 'Tide Alerts', '--goal', 'Ship it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a session name is 2 to 24 characters of a-z, 0-9 and -, and starts with a letter.\nRun: www init tide-alerts --goal "Ship it"\n',
    fills: [{}],
  },
  {
    title: 'an attach to a near miss of a session',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['attach', 'tide-alert'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no session tide-alert. Sessions: tide-alerts.\nRun: www attach tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'an attach when no session exists',
    setup: [],
    files: [],
    argv: ['attach', 'tide-alert'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no session tide-alert. Sessions: none.\nRun: www init tide-alert --goal "<what done means>"\n',
    fills: [{ '<what done means>': 'Ship it' }],
  },
  {
    title: 'an attach with no agent session id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['attach', 'tide-alerts'],
    env: 'shell',
    exitCode: 3,
    stderr:
      'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.\nRun: www --session tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'a detach with no agent session id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['detach'],
    env: 'shell',
    exitCode: 3,
    stderr:
      'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.\nRun: www --session <name>\n',
    fills: [{ '<name>': 'tide-alerts' }],
  },
  {
    title: 'a detach that names its session, with no agent session id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'detach'],
    env: 'shell',
    exitCode: 3,
    stderr:
      'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.\nRun: www --session tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'a detach with no binding',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['detach'],
    env: 'other-agent',
    exitCode: 3,
    stderr: 'www: refused: this Claude Code session has no binding.\nRun: www sessions\n',
    fills: [{}],
  },
  {
    title: 'no session for an unbound agent',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [],
    env: 'other-agent',
    exitCode: 4,
    stderr:
      'www: no session for this agent. Sessions on this machine: tide-alerts (day 1).\nRun: www attach <name>\nRun: www init <name> --goal "<what done means>"\n',
    fills: [{ '<name>': 'tide-alerts' }, { '<name>': 'new-notes', '<what done means>': 'Ship it' }],
  },
  {
    title: 'no session and no session at all (nothing to attach to)',
    setup: [],
    files: [],
    argv: [],
    env: 'other-agent',
    exitCode: 4,
    stderr:
      'www: no session for this agent. There are no sessions on this machine yet.\nRun: www attach <name>\nRun: www init <name> --goal "<what done means>"\n',
    fills: [],
  },
  {
    title: 'no session for a shell with no agent id (its Run lines run in an agent session)',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'x'],
    env: 'shell',
    replayEnv: 'agent',
    exitCode: 4,
    stderr:
      'www: no session for this agent. Sessions on this machine: tide-alerts (day 1).\nRun: www attach <name>\nRun: www init <name> --goal "<what done means>"\n',
    fills: [{ '<name>': 'tide-alerts' }, { '<name>': 'new-notes', '<what done means>': 'Ship it' }],
  },
  {
    title: 'a --session that names a missing session (its Run lines run in an agent session)',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'nope-notes', 'task', 't-a', 'x'],
    env: 'shell',
    replayEnv: 'agent',
    exitCode: 4,
    stderr:
      'www: no session nope-notes on this machine. Sessions on this machine: tide-alerts (day 1).\nRun: www --session nope-notes attach <name>\nRun: www --session nope-notes init <name> --goal "<what done means>"\n',
    fills: [{ '<name>': 'tide-alerts' }, { '<name>': 'new-notes', '<what done means>': 'Ship it' }],
  },
  {
    title: 'a hand-kept store',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'session',
        text: 'name=old-notes\ngoal=x\nstarted=2026-03-02T08:00:00Z\n',
      },
    ],
    argv: ['--session', 'old-notes'],
    env: 'agent',
    exitCode: 5,
    stderr:
      'www: old-notes is a hand-kept store (format 0-by-hand). Convert it first.\nRun: www --session old-notes import old-notes\n',
    fills: [{}],
  },
  {
    title: 'an import of a folder that does not exist',
    setup: [],
    files: [],
    argv: ['import', 'nope-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no session folder nope-notes to import. Sessions: none.\nRun: www sessions\n',
    fills: [{}],
  },
  {
    title: 'an import of a store that is format 2 already, with an agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['import', 'tide-alerts'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: tide-alerts is already format 2. Bind this agent session to it.\nRun: www attach tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'an import of a store that is format 2 already, with no agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['import', 'tide-alerts'],
    env: 'shell',
    exitCode: 3,
    stderr: 'www: refused: tide-alerts is already format 2.\nRun: www --session tide-alerts\n',
    fills: [{}],
  },
  {
    title:
      'an import of rows that break the rules (its Run line passes once the rows are fixed, which the import command test proves)',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'session',
        text: 'name=old-notes\ngoal=x\nstarted=2026-03-02T08:00:00Z\n',
      },
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: `id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\t${'c'.repeat(121)}\t-\t-\t-\t2026-03-02T09:00:00Z\tagent\t-\n`,
      },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: import found 1 rows that break the rules, and wrote nothing.\nitems.tsv line 2 (t-a): the claim is 121 characters, and the limit is 120.\nRun: www import old-notes\n',
    fills: [],
  },
  {
    title: 'a store of a newer format (its Run line installs from npm)',
    setup: [],
    files: [{ session: 'old-notes', name: 'session', text: 'format=3\n' }],
    argv: ['--session', 'old-notes'],
    env: 'agent',
    exitCode: 5,
    stderr:
      'www: old-notes is format 3, and this www reads format 2.\nRun: bun add -g @wherewerewe/cli@latest\n',
    fills: [],
  },
  {
    title: 'a store with a broken items file (its Run line opens a file in a pager)',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n',
      },
    ],
    argv: ['task', 't-b', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: tide-alerts's items.tsv line 2 does not parse: expected 9 tab-separated columns, found 2. Fix the row by hand.\nRun: less <STATE>/tide-alerts/items.tsv\n",
    fills: [],
  },
  {
    title: 'a store whose session holds a grant bullet with a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'session',
        text: 'format=2\nname=tide-alerts\ngoal=Ship it\ngrant_may=water\tthe beds\ngrant_scope=\ngrant_reading=covers watering\ngrant_where=chat\ngrant_set=2026-03-03T09:00:00Z\nstarted=2026-03-02T08:00:00Z\nnow=\nnow_next=\nnow_set=\nlast_write=\nlast_nudge=\n',
      },
    ],
    argv: ['task', 't-b', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: tide-alerts's session does not parse: a grant bullet holds a tab or a line break. Fix the file by hand.\nRun: less <STATE>/tide-alerts/session\n",
    fills: [],
  },
  {
    title: 'an unknown command',
    setup: [],
    files: [],
    argv: ['taks'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: unknown command "taks".\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a command of a later version',
    setup: [],
    files: [],
    argv: ['doctor', 'tide-alerts'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: "doctor" comes in a later version of www.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'an unknown flag',
    setup: [],
    files: [],
    argv: ['task', 't-a', 'x', '--colour', 'red'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: unknown flag "--colour".\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a flag with no value',
    setup: [],
    files: [],
    argv: ['goal', 'x', '--session'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --session needs a value.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a flag followed by another flag',
    setup: [],
    files: [],
    argv: ['init', 'new-session', '--goal', '--session'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --goal needs a value.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a flag that takes no value, given one',
    setup: [],
    files: [],
    argv: ['task', 't-a', 'x', '--help=yes'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --help takes no value.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a command named like an object property',
    setup: [],
    files: [],
    argv: ['toString'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: unknown command "toString".\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'an unknown command typed with --session',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'taks'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: unknown command "taks".\nRun: www --session tide-alerts help\n',
    fills: [{}],
  },
  {
    title: 'a flag the command does not take',
    setup: [],
    files: [],
    argv: ['done', 't-a', '--why', 'x'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: done takes no --why flag.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'the wrong number of arguments',
    setup: [],
    files: [],
    argv: ['task', 't-a'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: task takes <id> "<claim>".\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'an approval with nothing but its id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['ok', 'ok-a'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, and what they cover.\nRun: www ok ok-a --quote "<their exact words>" --who "<who>" --where "<where>" --scope "<what it covers>"\n',
    fills: [
      {
        '<their exact words>': 'merge yourself',
        '<who>': 'owner',
        '<where>': 'chat',
        '<what it covers>': 'bosun-api',
      },
    ],
  },
  {
    title: 'an approval with no scope',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, and what they cover.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope "<what it covers>"\n',
    fills: [{ '<what it covers>': 'bosun-api' }],
  },
  {
    title: 'an approval with no quote',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['ok', 'ok-a', '--who', 'owner', '--where', 'chat', '--scope', 'bosun-api'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, and what they cover.\nRun: www ok ok-a --who owner --where chat --scope bosun-api --quote "<their exact words>"\n',
    fills: [{ '<their exact words>': 'merge yourself' }],
  },
  {
    title: 'a quote over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'q'.repeat(121),
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the quote is 121 characters, and the limit is 120. Write what is true now, and put the detail in its note with --note.\nRun: www ok ok-a --quote "<quote of at most 120 characters>" --who owner --where chat --scope bosun-api --once\n',
    fills: [{ '<quote of at most 120 characters>': 'merge yourself' }],
  },
  {
    title: 'an approval who over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'w'.repeat(17),
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the who is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.\nRun: www ok ok-a --quote "merge yourself" --who "<who of at most 16 characters>" --where chat --scope bosun-api --once\n',
    fills: [{ '<who of at most 16 characters>': 'owner' }],
  },
  {
    title: 'an approval where over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'w'.repeat(17),
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the where is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.\nRun: www ok ok-a --quote "merge yourself" --who owner --where "<where of at most 16 characters>" --scope bosun-api --once\n',
    fills: [{ '<where of at most 16 characters>': 'chat' }],
  },
  {
    title: 'an approval scope over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      's'.repeat(41),
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the scope is 41 characters, and the limit is 40. Write what is true now; the story belongs in a PR or a commit.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope "<scope of at most 40 characters>" --once\n',
    fills: [{ '<scope of at most 40 characters>': 'bosun-api' }],
  },
  {
    title: 'an approval quote of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      '-',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the quote is empty.\nRun: www ok ok-a --quote "<quote>" --who owner --where chat --scope bosun-api --once\n',
    fills: [{ '<quote>': 'merge yourself' }],
  },
  {
    title: 'an approval scope with a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'a\tb',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope "<one line>" --once\n',
    fills: [{ '<one line>': 'bosun-api' }],
  },
  {
    title: 'an approval where with a semicolon and an equals sign',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'a;b=c',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --where cannot hold ; or =.\nRun: www ok ok-a --quote "merge yourself" --who owner --where a,b,c --scope bosun-api --once\n',
    fills: [{}],
  },
  {
    title: 'an approval scope with an equals sign',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'a=b',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --scope cannot hold ; or =.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope a,b --once\n',
    fills: [{}],
  },
  {
    title: 'an approval who with a semicolon',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'a;b',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --who cannot hold ; or =.\nRun: www ok ok-a --quote "merge yourself" --who a,b --where chat --scope bosun-api --once\n',
    fills: [{}],
  },
  {
    title: 'a credential in an approval quote',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      `AKIA${'Q'.repeat(16)}`,
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www ok ok-a --quote "<where the secret lives>" --who owner --where chat --scope bosun-api --once\n',
    fills: [{ '<where the secret lives>': 'merge yourself' }],
  },
  {
    title: 'a credential in an approval scope',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      `AKIA${'Q'.repeat(16)}`,
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope "<where the secret lives>" --once\n',
    fills: [{ '<where the secret lives>': 'bosun-api' }],
  },
  {
    title: 'a second approval while the one-time approval is open',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
      ],
    ],
    files: [],
    argv: [
      'ok',
      'ok-b',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the brief holds 1 of 1 one-time approvals. Spend it with www use, or drop it.\nRun: www use ok-a --for "<what you did with it>"\n',
    fills: [{ '<what you did with it>': 'merged it' }],
  },
  {
    title: 'an approval on a closed id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
      ['use', 'ok-a', '--for', 'merged it'],
    ],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: ok-a closed on day 1. Pick a new id.\nRun: www ok <new id> --quote "merge yourself" --who owner --where chat --scope bosun-api --once\n',
    fills: [{ '<new id>': 'ok-b' }],
  },
  {
    title: 'an approval on an open task',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 'ok-a', 'Write it'],
    ],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: ok-a is a task. Change its text with set, or pick a new id.\nRun: www set ok-a "merge yourself"\n',
    fills: [{}],
  },
  {
    title: 'an approval on an id that breaks the id rule',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'OK a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope bosun-api --once\n',
    fills: [{}],
  },
  {
    title: 'use on a task',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['use', 't-a', '--for', 'merged it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: t-a is a task, and use spends the one-time approval.\nRun: www done t-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'use on a rule',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['rule', 'r-a', 'Run from api/'],
    ],
    files: [],
    argv: ['use', 'r-a', '--for', 'merged it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: r-a is a rule, and use spends the one-time approval.\nRun: www done r-a --evidence "<PR, commit or test run>"\n',
    fills: [{ '<PR, commit or test run>': 'commit 4c1d2e0' }],
  },
  {
    title: 'use with no --for',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-a'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: use needs what you did with it.\nRun: www use ok-a --for "<what you did with it>"\n',
    fills: [{ '<what you did with it>': 'merged the PR' }],
  },
  {
    title: 'use on an id that is not open',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-b', '--for', 'merged it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item ok-b. Open items: ok-a.\nRun: www use ok-a --for "merged it"\n',
    fills: [{}],
  },
  {
    title: 'a --for text over its limit',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-a', '--for', 'f'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the --for text is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www use ok-a --for "<--for text of at most 200 characters>"\n',
    fills: [{ '<--for text of at most 200 characters>': 'merged it' }],
  },
  {
    title: 'a --for text of one dash, which the journal would read as no text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-a', '--for', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the --for text is empty.\nRun: www use ok-a --for "<--for text>"\n',
    fills: [{ '<--for text>': 'merged it' }],
  },
  {
    title: 'a credential in a --for text',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-a', '--for', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www use ok-a --for "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'merged it' }],
  },
  {
    title: 'a decision with no --why',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a decision needs its reason.\nRun: www decide "Retry a 503 3 times" --why "<reason>"\n',
    fills: [{ '<reason>': 'The feed flaps' }],
  },
  {
    title: 'a decision over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'd'.repeat(201), '--why', 'The feed flaps'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the decision is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www decide "<decision of at most 200 characters>" --why "The feed flaps"\n',
    fills: [{ '<decision of at most 200 characters>': 'Retry a 503 3 times' }],
  },
  {
    title: 'a decision reason over its limit',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'r'.repeat(201)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the reason is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.\nRun: www decide "Retry a 503 3 times" --why "<reason of at most 200 characters>"\n',
    fills: [{ '<reason of at most 200 characters>': 'The feed flaps' }],
  },
  {
    title: 'a decision reason with a newline',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'a\nb'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www decide "Retry a 503 3 times" --why "<one line>"\n',
    fills: [{ '<one line>': 'The feed flaps' }],
  },
  {
    title: 'a decision of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', '-', '--why', 'The feed flaps'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the decision is empty.\nRun: www decide "<decision>" --why "The feed flaps"\n',
    fills: [{ '<decision>': 'Retry a 503 3 times' }],
  },
  {
    title: 'a credential in a decision',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', `AKIA${'Q'.repeat(16)}`, '--why', 'The feed flaps'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "<where the secret lives>" --why "The feed flaps"\n',
    fills: [{ '<where the secret lives>': 'Retry a 503 3 times' }],
  },
  {
    title: 'a credential in a decision reason',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "Retry a 503 3 times" --why "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'The feed flaps' }],
  },
  {
    title: 'a decision with a --who that is neither owner nor agent',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--who', 'sam'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --who on a decision is owner or agent.\nRun: www decide "Retry a 503 3 times" --why "The feed flaps" --who "<owner or agent>"\n',
    fills: [{ '<owner or agent>': 'owner' }],
  },
  {
    title: 'a decision on a near miss of an open id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 'pr-api-77', 'x'],
    ],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--on', 'pr-api-78'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item pr-api-78. Open items: pr-api-77.\nRun: www decide "Retry a 503 3 times" --why "The feed flaps" --on pr-api-77\n',
    fills: [{}],
  },
  {
    title: 'a decision on an id far from every open id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 'pr-api-77', 'x'],
    ],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--on', 'zzzzzzzzzz'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item zzzzzzzzzz. Open items: pr-api-77.\nRun: www decide "Retry a 503 3 times" --why "The feed flaps"\n',
    fills: [{}],
  },
  {
    title: 'a decision that replaces a decision that does not exist, with decisions made',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['decide', 'First choice', '--why', 'A reason'],
      ['decide', 'Second choice', '--why', 'A reason'],
    ],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--replaces', 'd-40'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: there is no decision d-40; the last is d-2.\nRun: www log --op decide,ruled-out\n',
    fills: [{}],
  },
  {
    title: 'a decision that replaces a decision when there are none',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps', '--replaces', 'd-1'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: there is no decision d-1; there are no decisions yet.\nRun: www log --op decide,ruled-out\n',
    fills: [{}],
  },
  {
    title: 'a decision when the journal holds the last safe decision number',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'journal.tsv',
        text: `ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T10:00:00Z\tdecide\td-${String(Number.MAX_SAFE_INTEGER)}\tagent\tRetry\tThe feed flaps\twho=agent\n`,
      },
    ],
    argv: ['decide', 'Retry a 503 3 times', '--why', 'The feed flaps'],
    env: 'agent',
    exitCode: 3,
    stderr: `www: refused: decision numbers are used up after d-${String(Number.MAX_SAFE_INTEGER)}.\nRun: www log --op decide,ruled-out\n`,
    fills: [{}],
  },
  {
    title: "a decision that replaces the owner's decision",
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['decide', 'Use the vault', '--why', 'The owner said so', '--who', 'owner'],
    ],
    files: [],
    argv: ['decide', 'Use a file', '--why', 'It is simpler', '--replaces', 'd-1'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: d-1 is the owner\'s decision, so only a decision recorded with --who owner replaces it.\nRun: www decide "<the owner\'s answer>" --why "<reason>" --who owner --replaces d-1\n',
    fills: [{ "<the owner's answer>": 'Keep the vault', '<reason>': 'The owner decided' }],
  },
  {
    title: 'a --since that is not 24h, 3d or day-7',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['log', '--since', 'yesterday'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www log --since 24h\n',
    fills: [{}],
  },
  {
    title: 'a recap --since that is not 24h, 3d or day-7',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['recap', '--since', 'soon'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www recap --since 24h\n',
    fills: [{}],
  },
  {
    title: 'a recap --since that starts with a dash',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['recap', '--since', '-2h'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www recap --since 24h\n',
    fills: [{}],
  },
  {
    title: 'a recap --since joined with = that starts with a dash',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['recap', '--since=-2h'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www recap --since 24h\n',
    fills: [{}],
  },
  {
    title: 'a log --since that starts with a dash',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['log', '--since', '-2h'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --since takes 24h, 3d or day-7.\nRun: www log --since 24h\n',
    fills: [{}],
  },
  {
    title: 'a recap --since of a session typed with --session',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['recap', '--since', 'soon', '--session', 'tide-alerts'],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: --since takes 24h, 3d or day-7.\nRun: www --session tide-alerts recap --since 24h\n',
    fills: [{}],
  },
  {
    title: 'an approval that lacks a part, with a credential in its quote',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      `AKIA${'Q'.repeat(16)}`,
      '--who',
      'owner',
      '--where',
      'chat',
      '--once',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, and what they cover.\nRun: www ok ok-a --quote "<where the secret lives>" --who owner --where chat --scope "<what it covers>"\n',
    fills: [{ '<where the secret lives>': 'merge yourself', '<what it covers>': 'bosun-api' }],
  },
  {
    title: 'an approval that lacks a part, with a quote that starts with two dashes',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['ok', 'ok-b', '--quote=--preview', '--where', 'chat', '--scope', 'tests', '--once'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, and what they cover.\nRun: www ok ok-b --quote="--preview" --where chat --scope tests --who "<who>"\n',
    fills: [{ '<who>': 'owner' }],
  },
  {
    title: 'a decision with a credential in both its choice and its reason',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', `AKIA${'Q'.repeat(16)}`, '--why', `AKIA${'R'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "<where the secret lives>" --why "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'Retry a 503 3 times' }],
  },
  {
    title: 'a decision that replaces a credential-shaped id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'decide',
      'Retry a 503 3 times',
      '--why',
      'The feed flaps',
      '--replaces',
      `AKIA${'Q'.repeat(16)}`,
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: there is no decision <where the secret lives>; there are no decisions yet.\nRun: www log --op decide,ruled-out\n',
    fills: [{}],
  },
  {
    title: 'use on a near miss of a task, with an open approval and a task',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-b', 'Write it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 't-a', '--for', 'tested'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: no open item t-a. Open items: t-b, ok-a.\nRun: www use ok-a --for tested\n',
    fills: [{}],
  },
  {
    title: 'a --for text with a tab',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
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
        'bosun-api',
        '--once',
      ],
    ],
    files: [],
    argv: ['use', 'ok-a', '--for', 'a\tb'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www use ok-a --for "<one line>"\n',
    fills: [{ '<one line>': 'merged it' }],
  },
  {
    title: 'a say from an agent shell',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['say', 'Ask me first'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: only the owner writes owner notes, from a terminal outside any agent. Record what the owner told you as a rule, a wait, an approval or the grant.\nRun: www rule <id> "<what the owner said, as a rule>"\n',
    fills: [
      {
        '<id>': 'r-owner-port',
        '<what the owner said, as a rule>': 'Ask before you change the kiln simulator port',
      },
    ],
  },
  {
    title: 'a third owner note',
    setupEnv: 'owner',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['--session', 'tide-alerts', 'say', 'Ask me first'],
      ['--session', 'tide-alerts', 'say', 'Use the recorded readings'],
    ],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', 'A third note'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: 2 owner notes already show. Clear one that is done.\nRun: www --session tide-alerts ack o-1\n',
    fills: [{}],
  },
  {
    title: 'an ack of a note that does not show',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'ack', 'o-9'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: no owner note o-9 shows. Owner notes: none.\nRun: www --session tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'an owner note over its limit',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', 'n'.repeat(161)],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: the owner note is 161 characters, and the limit is 160. Write what is true now; the story belongs in a PR or a commit.\nRun: www --session tide-alerts say "<owner note of at most 160 characters>"\n',
    fills: [{ '<owner note of at most 160 characters>': 'Ask me first' }],
  },
  {
    title: 'an owner note with a tab',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', 'a\tb'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www --session tide-alerts say "<one line>"\n',
    fills: [{ '<one line>': 'Ask me first' }],
  },
  {
    title: 'an empty owner note',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', ''],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: the owner note is empty.\nRun: www --session tide-alerts say "<owner note>"\n',
    fills: [{ '<owner note>': 'Ask me first' }],
  },
  {
    title: 'an owner note of a lone dash',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', '-'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: the owner note is empty.\nRun: www --session tide-alerts say "<owner note>"\n',
    fills: [{ '<owner note>': 'Ask me first' }],
  },
  {
    title: 'an owner note with a credential',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', `Deploy with AKIA${'Q'.repeat(16)}`],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www --session tide-alerts say "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'Ask me first' }],
  },
  {
    title: 'a say when the journal holds the last safe owner note number',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'journal.tsv',
        text: `ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T10:00:00Z\tsay\to-${String(Number.MAX_SAFE_INTEGER)}\timport\tAsk me first\t-\t-\n`,
      },
    ],
    argv: ['--session', 'tide-alerts', 'say', 'Hello'],
    env: 'owner',
    exitCode: 3,
    stderr: `www: refused: owner note numbers are used up after o-${String(Number.MAX_SAFE_INTEGER)}.\nRun: www --session tide-alerts log --op say\n`,
    fills: [{}],
  },
  {
    title: 'a say on a decision id, which owner.tsv cannot hold',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'journal.tsv',
        text: 'ts\top\tid\tby\ttext\twhy\textra\n2026-03-10T10:00:00Z\tdone\td-1\tagent\tRetry\t-\t-\n',
      },
    ],
    argv: ['--session', 'tide-alerts', 'say', 'Hello', '--on', 'd-1'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: no open item d-1. Open items: none.\nRun: www --session tide-alerts say Hello\n',
    fills: [{}],
  },
  {
    title: 'a say on an item that is not open',
    setupEnv: 'owner',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'tide-alerts', 'say', 'Hello', '--on', 't-none'],
    env: 'owner',
    exitCode: 3,
    stderr:
      'www: refused: no open item t-none. Open items: none.\nRun: www --session tide-alerts say Hello\n',
    fills: [{}],
  },
  {
    title: 'a note over its limit on a task with a new id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-e2e', 'Write it', '--note', 'n'.repeat(401)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the note is 401 characters, and the limit is 400. Keep what you need on your next turn to this item, and link the rest from a PR, an issue or a file.\nRun: www task t-e2e "Write it" --note "<note of at most 400 characters>"\n',
    fills: [{ '<note of at most 400 characters>': 'A short note' }],
  },
  {
    title: 'a note over its limit on a set',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-a', '--note', 'n'.repeat(401)],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the note is 401 characters, and the limit is 400. Keep what you need on your next turn to this item, and link the rest from a PR, an issue or a file.\nRun: www set t-a --note "<note of at most 400 characters>"\n',
    fills: [{ '<note of at most 400 characters>': 'A short note' }],
  },
  {
    title: 'a note with a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Write it', '--note', 'a\tb'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www task t-a "Write it" --note "<one line>"\n',
    fills: [{ '<one line>': 'One line' }],
  },
  {
    title: 'an empty note',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Write it', '--note', ''],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the note is empty.\nRun: www task t-a "Write it" --note "<note>"\n',
    fills: [{ '<note>': 'A note' }],
  },
  {
    title: 'a note of one dash, which the journal would read as no text',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Write it', '--note', '-'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: the note is empty.\nRun: www task t-a "Write it" --note "<note>"\n',
    fills: [{ '<note>': 'A note' }],
  },
  {
    title: 'a note with a credential',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Write it', '--note', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www task t-a "Write it" --note "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'The key is in the vault' }],
  },
  {
    title: '--owed with no --note on a task with a new id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Write it', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --owed marks a note, and this command gives none.\nRun: www task t-a "Write it" --note "<what is owed>" --owed\n',
    fills: [{ '<what is owed>': 'Stop the simulator' }],
  },
  {
    title: '--owed with no --note on a set',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-flag', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-flag', '--owed'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --owed marks a note, and this command gives none.\nRun: www set t-flag --note "<what is owed>" --owed\n',
    fills: [{ '<what is owed>': 'Stop the simulator' }],
  },
  {
    title: '--note with --no-note on a set with a claim',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-a', 'Claim', '--note', 'detail', '--no-note'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --note replaces the note and --no-note clears it; give one.\nRun: www set t-a Claim --note detail\n',
    fills: [{}],
  },
  {
    title: '--note with --no-note on a set with no claim',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-a', '--no-note', '--note', 'detail'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --note replaces the note and --no-note clears it; give one.\nRun: www set t-a --note detail\n',
    fills: [{}],
  },
  {
    title: 'a set with only an id',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-flag', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-flag'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: set needs a claim, --note or --no-note.\nRun: www set t-flag "<claim>"\n',
    fills: [{ '<claim>': 'Write it better' }],
  },
  {
    title: 'a set with a check and no claim',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-a', '--pid', '5'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a check belongs to a claim, and set with no claim changes only the note.\nRun: www set t-a "<claim>" --pid 5\n',
    fills: [{ '<claim>': 'Write it better' }],
  },
  {
    title: 'a set with a check, a note and no claim',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-a', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-a', '--pid', '5', '--note', 'detail'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a check belongs to a claim, and set with no claim changes only the note.\nRun: www set t-a "<claim>" --pid 5 --note detail\n',
    fills: [{ '<claim>': 'Write it better' }],
  },
  {
    title: 'a task with a note while a notes.tsv row does not parse',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [{ session: 'tide-alerts', name: 'notes.tsv', text: 'id\towed\twritten\tnote\nt-a\n' }],
    argv: ['task', 't-b', 'Write it', '--note', 'detail'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: tide-alerts's notes.tsv line 2 does not parse: expected 4 tab-separated columns, found 1. Fix the row by hand.\nRun: less <STATE>/tide-alerts/notes.tsv\n",
    fills: [],
  },
  {
    title: '--no-note on an item with no note',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      ['task', 't-e2e', 'Write it'],
    ],
    files: [],
    argv: ['set', 't-e2e', '--no-note'],
    env: 'agent',
    exitCode: 3,
    stderr: 'www: refused: t-e2e has no note to clear.\nRun: www show t-e2e\n',
    fills: [{}],
  },
  {
    title: 'a done on an item with an owed note',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'task',
        't-flag',
        'Turn it on',
        '--note',
        'Turn the flag back off before this closes.',
        '--owed',
      ],
    ],
    files: [],
    argv: ['done', 't-flag', '--evidence', 'commit 4c1d2e0'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: t-flag has an owed note (0m). Clear it once the work is done, or replace it with a note that is not owed.\n    Turn the flag back off before this closes.\nRun: www set t-flag --no-note\nRun: www set t-flag --note "<detail>"\n',
    fills: [{}, { '<detail>': 'Flag is off again' }],
  },
  {
    title: 'a drop on an item with an owed note',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'task',
        't-flag',
        'Turn it on',
        '--note',
        'Turn the flag back off before this closes.',
        '--owed',
      ],
    ],
    files: [],
    argv: ['drop', 't-flag', '--why', 'stopped'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: t-flag has an owed note (0m). Clear it once the work is done, or replace it with a note that is not owed.\n    Turn the flag back off before this closes.\nRun: www set t-flag --no-note\nRun: www set t-flag --note "<detail>"\n',
    fills: [{}, { '<detail>': 'Flag is off again' }],
  },
  {
    title: 'a use on an approval with an owed note',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'ok',
        'ok-wipe',
        '--quote',
        'wipe it',
        '--who',
        'owner',
        '--where',
        'chat',
        '--scope',
        'tide',
        '--once',
        '--note',
        'Check the tmp dir first.',
        '--owed',
      ],
    ],
    files: [],
    argv: ['use', 'ok-wipe', '--for', 'wiped it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: ok-wipe has an owed note (0m). Clear it once the work is done, or replace it with a note that is not owed.\n    Check the tmp dir first.\nRun: www set ok-wipe --no-note\nRun: www set ok-wipe --note "<detail>"\n',
    fills: [{}, { '<detail>': 'The tmp dir is clean' }],
  },
  {
    title:
      'a format 1 store with a one-time approval and no standing approval, whose Run line upgrades it',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-wipe\tok\tyou can wipe the staging sensor table once\t-\t-\t-\t2026-03-05T09:00:00Z\tagent\twho=owner;where=chat;scope=staging sensor table;use=once\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
      { session: '.bindings', name: 'claude-a1b2-test', text: 'name=old-notes\n' },
    ],
    argv: [],
    env: 'agent',
    exitCode: 5,
    stderr:
      'www: old-notes is format 1, and this www reads format 2. Upgrade it in place; the upgrade keeps a copy of each file it changes, and changes nothing when it refuses.\nRun: www import old-notes\n',
    fills: [{}],
  },
  {
    title: 'an upgrade of a store with standing approvals and no grant',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-merge\tok\tmerge the garden-api PRs yourself once CI is green\t-\t-\t-\t2026-03-03T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=standing\nok-deploy\tok\tdeploy to the staging beds whenever you need to\t-\t-\t-\t2026-03-04T09:00:00Z\tagent\twho=owner;where=chat;scope=staging beds;use=standing\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: old-notes holds 2 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner\'s words in the same command.\n  ok-merge   "merge the garden-api PRs yourself once CI is green" · garden-api\n  ok-deploy  "deploy to the staging beds whenever you need to" · staging beds\nRun: www import old-notes --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what they cover; what the owner kept back>': 'covers merges',
      },
    ],
  },
  {
    title: 'an upgrade of a store with two one-time approvals',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-wipe\tok\tyou can wipe the staging sensor table once\t-\t-\t-\t2026-03-05T09:00:00Z\tagent\twho=owner;where=chat;scope=staging sensor table;use=once\nok-tags\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: old-notes holds 2 one-time approvals, and format 2 holds 1. Drop all but one.\n  ok-wipe  "you can wipe the staging sensor table once" · staging sensor table  [5d]\n  ok-tags  "push the garden-api tags" · garden-api  [2d]\nRun: www import old-notes --drop ok-wipe\n',
    fills: [{}],
  },
  {
    title: 'an upgrade of a store with an item named grant',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\ngrant\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: format 2 keeps the id grant for the grant, and old-notes has an item grant. Drop it, and write it again under a new id after the upgrade.\nRun: www import old-notes --drop grant\n',
    fills: [{}],
  },
  {
    title: 'an import of a hand-kept store with an open question named grant',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'session',
        text: 'name=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\n',
      },
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      {
        session: 'old-notes',
        name: 'journal.tsv',
        text: 'ts\top\tid\ttext\n2026-03-06T10:00:00Z\topen\tgrant\tWho may merge\n',
      },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: format 2 keeps the id grant for the grant, and old-notes has an item grant. Drop it, and write it again under a new id after the upgrade.\nRun: www import old-notes --drop grant\n',
    fills: [{}],
  },
  {
    title: 'an upgrade with a --drop that names no item',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes', '--drop', 'nope'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --drop nope names no item in old-notes. Items: t-valves.\nRun: www import old-notes\n',
    fills: [{}],
  },
  {
    title: 'an upgrade with a --drop value that looks like a credential',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes', '--drop', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --drop <where the secret lives> names no item in old-notes. Items: t-valves.\nRun: www import old-notes\n',
    fills: [{}],
  },
  {
    title: 'an upgrade with a reading and bullets that are both over their limits',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: [
      'import',
      'old-notes',
      ...Array.from({ length: 5 }, () => ['--may', 'w'.repeat(120)]).flat(),
      '--not',
      'n'.repeat(100),
      '--scope',
      's',
      '--where',
      'chat',
      '--reading',
      'r'.repeat(201),
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant\'s words are 701 characters in its bullets and scope, and the limit is 700.\nwww: refused: the reading is 201 characters, and the limit is 200.\nRun: www import old-notes --may "<what the owner allows, in their words>" --not "<what the owner did not grant, in their words>" --scope s --where chat --reading "<reading of at most 200 characters>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what the owner did not grant, in their words>': 'Prune the roses.',
        '<reading of at most 200 characters>': 'covers merges',
      },
    ],
  },
  {
    title: 'an import of a journal with a broken header',
    format1: 'old-notes',
    setup: [],
    files: [{ session: 'old-notes', name: 'journal.tsv', text: 'ts\top\tid\n' }],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: old-notes's journal.tsv line 1 does not parse: the header is not the journal header. Fix the row by hand.\nRun: less <STATE>/old-notes/journal.tsv\n",
    fills: [],
  },
  {
    title: 'an upgrade with only --may',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes', '--may', 'Merge it yourself.'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a grant needs at least one --may in the owner\'s words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www import old-notes --may "Merge it yourself." --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [{ '<what they cover; what the owner kept back>': 'covers merges' }],
  },
  {
    title: 'an upgrade with grant words of 701 characters across bullets and scope',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: [
      'import',
      'old-notes',
      ...Array.from({ length: 5 }, () => ['--may', 'w'.repeat(120)]).flat(),
      '--not',
      'n'.repeat(100),
      '--scope',
      's',
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant\'s words are 701 characters in its bullets and scope, and the limit is 700.\nRun: www import old-notes --may "<what the owner allows, in their words>" --not "<what the owner did not grant, in their words>" --scope s --where chat --reading "covers merges"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what the owner did not grant, in their words>': 'Prune the roses.',
      },
    ],
  },
  {
    title: 'an upgrade with a second --may of 121 characters',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: [
      'import',
      'old-notes',
      '--may',
      'Water the beds.',
      '--may',
      'b'.repeat(121),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet is 121 characters, and the limit is 120. Give each part of the grant its own --may, --not or --never.\nRun: www import old-notes --may "Water the beds." --may "<bullet of at most 120 characters>" --where chat --reading "covers watering"\n',
    fills: [{ '<bullet of at most 120 characters>': 'Mow the lawn.' }],
  },
  {
    title: 'an upgrade that meets every problem at once',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-merge\tok\tmerge the garden-api PRs yourself once CI is green\t-\t-\t-\t2026-03-03T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=standing\nok-wipe\tok\tyou can wipe the staging sensor table once\t-\t-\t-\t2026-03-05T09:00:00Z\tagent\twho=owner;where=chat;scope=staging sensor table;use=once\nok-tags\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\ngrant\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes', '--drop', 'nope'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: old-notes holds 1 standing approvals, and format 2 keeps lasting permission in the grant. Record the owner\'s words in the same command.\n  ok-merge  "merge the garden-api PRs yourself once CI is green" · garden-api\nwww: refused: old-notes holds 2 one-time approvals, and format 2 holds 1. Drop all but one.\n  ok-wipe  "you can wipe the staging sensor table once" · staging sensor table  [5d]\n  ok-tags  "push the garden-api tags" · garden-api  [2d]\nwww: refused: format 2 keeps the id grant for the grant, and old-notes has an item grant. Drop it, and write it again under a new id after the upgrade.\nwww: refused: --drop nope names no item in old-notes. Items: ok-merge, ok-wipe, ok-tags, grant.\nRun: www import old-notes --drop ok-wipe --drop grant --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what they cover; what the owner kept back>': 'covers merges',
      },
    ],
  },
  {
    title: 'an approval with --standing',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'ok',
      'ok-a',
      '--quote',
      'merge yourself',
      '--who',
      'owner',
      '--where',
      'chat',
      '--scope',
      'bosun-api',
      '--standing',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: lasting permission lives in the grant, in the owner\'s words whole.\nRun: www grant --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what they cover; what the owner kept back>': 'covers merges',
      },
    ],
  },
  {
    title: 'a grant with no flag',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a grant needs at least one --may in the owner\'s words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www grant --may "<what the owner allows, in their words>" --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what they cover; what the owner kept back>': 'covers merges',
      },
    ],
  },
  {
    title: 'a grant with only --may',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--may', 'Merge it yourself.'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a grant needs at least one --may in the owner\'s words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www grant --may "Merge it yourself." --where chat --reading "<what they cover; what the owner kept back>"\n',
    fills: [{ '<what they cover; what the owner kept back>': 'covers merges' }],
  },
  {
    title: 'a grant with only --not and no --may',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--not', 'Prune the roses.', '--where', 'chat', '--reading', 'covers watering'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a grant needs at least one --may in the owner\'s words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www grant --not "Prune the roses." --where chat --reading "covers watering" --may "<what the owner allows, in their words>"\n',
    fills: [{ '<what the owner allows, in their words>': 'Water the beds.' }],
  },
  {
    title: 'a grant with only --where',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--where', 'chat'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: a grant needs at least one --may in the owner\'s words, where they were given, and your reading of what they cover and what the owner kept back.\nRun: www grant --where chat --may "<what the owner allows, in their words>" --reading "<what they cover; what the owner kept back>"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what they cover; what the owner kept back>': 'covers merges',
      },
    ],
  },
  {
    title: 'a grant reading with no grant',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--reading', 'covers merges'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: tide-alerts has no grant, so there is no reading to replace.\nRun: www grant --may "<what the owner allows, in their words>" --where "<where>" --reading "covers merges"\n',
    fills: [{ '<what the owner allows, in their words>': 'Merge it yourself.', '<where>': 'chat' }],
  },
  {
    title: 'grant words of 701 characters across bullets and scope',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      ...Array.from({ length: 5 }, () => ['--may', 'w'.repeat(120)]).flat(),
      '--not',
      'n'.repeat(100),
      '--scope',
      's',
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant\'s words are 701 characters in its bullets and scope, and the limit is 700.\nRun: www grant --may "<what the owner allows, in their words>" --not "<what the owner did not grant, in their words>" --scope s --where chat --reading "covers merges"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Merge it yourself.',
        '<what the owner did not grant, in their words>': 'Prune the roses.',
      },
    ],
  },
  {
    title: 'a grant of 13 bullets',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      ...Array.from({ length: 12 }, () => ['--may', 'Water.']).flat(),
      '--never',
      'Dig up the roses.',
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant has 13 bullets, and the limit is 12. Put two parts that belong together in one bullet.\nRun: www grant --may "<what the owner allows, in their words>" --never "<what the owner ruled out, in their words>" --where chat --reading "covers watering"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Water the beds.',
        '<what the owner ruled out, in their words>': 'Dig up the roses.',
      },
    ],
  },
  {
    title: 'a grant with a second --may of 121 characters',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--may',
      'b'.repeat(121),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet is 121 characters, and the limit is 120. Give each part of the grant its own --may, --not or --never.\nRun: www grant --may "Water the beds." --may "<bullet of at most 120 characters>" --where chat --reading "covers watering"\n',
    fills: [{ '<bullet of at most 120 characters>': 'Mow the lawn.' }],
  },
  {
    title: 'a grant scope of 41 characters',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--scope',
      's'.repeat(41),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant\'s scope is 41 characters, and the limit is 40.\nRun: www grant --may "Water the beds." --scope "<grant\'s scope of at most 40 characters>" --where chat --reading "covers watering"\n',
    fills: [{ "<grant's scope of at most 40 characters>": 'the east garden' }],
  },
  {
    title: 'a grant reading of 201 characters',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Merge it yourself.',
      '--where',
      'chat',
      '--reading',
      'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the reading is 201 characters, and the limit is 200.\nRun: www grant --may "Merge it yourself." --where chat --reading "<reading of at most 200 characters>"\n',
    fills: [{ '<reading of at most 200 characters>': 'covers merges' }],
  },
  {
    title: 'a credential in a grant bullet',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--not',
      `token ${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}`,
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www grant --may "Water the beds." --not "<where the secret lives>" --where chat --reading "covers merges"\n',
    fills: [{ '<where the secret lives>': 'the vault item for the owner' }],
  },
  {
    title: 'a credential in the grant scope',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--scope',
      ['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join(''),
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www grant --may "Water the beds." --scope "<where the secret lives>" --where chat --reading "covers merges"\n',
    fills: [{ '<where the secret lives>': 'the east garden' }],
  },
  {
    title: 'a credential in the grant reading',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Merge it yourself.',
      '--where',
      'chat',
      '--reading',
      `token ${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}`,
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www grant --may "Merge it yourself." --where chat --reading "<where the secret lives>"\n',
    fills: [{ '<where the secret lives>': 'covers merges' }],
  },
  {
    title: 'a grant where of 17 characters',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Merge it yourself.',
      '--where',
      'wwwwwwwwwwwwwwwww',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the where is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.\nRun: www grant --may "Merge it yourself." --where "<where of at most 16 characters>" --reading "covers merges"\n',
    fills: [{ '<where of at most 16 characters>': 'chat' }],
  },
  {
    title: 'a grant where with a semicolon',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Merge it yourself.',
      '--where',
      'chat;x',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: --where cannot hold ; or =.\nRun: www grant --may "Merge it yourself." --where chat,x --reading "covers merges"\n',
    fills: [{}],
  },
  {
    title: 'a grant bullet that starts with two dashes',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--never',
      '--admin or a ruleset bypass',
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: the value of --never starts with a dash, so it reads as a flag. Join the two with =, as in --never="<value>".\nRun: www grant --may "Water the beds." --never="--admin or a ruleset bypass" --where chat --reading "covers watering"\n',
    fills: [{}],
  },
  {
    title: 'a scoped grant whose reading starts with a dash',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      '--session',
      'tide-alerts',
      'grant',
      '--may',
      'Water the beds.',
      '--where',
      'chat',
      '--reading',
      '-covers watering',
    ],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: the value of --reading starts with a dash, so it reads as a flag. Join the two with =, as in --reading="<value>".\nRun: www --session tide-alerts grant --may "Water the beds." --where chat --reading="-covers watering"\n',
    fills: [{}],
  },
  {
    title: 'a grant bullet of a lone dash',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--may', '-', '--where', 'chat', '--reading', 'covers watering'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet is empty.\nRun: www grant --may "<bullet>" --where chat --reading "covers watering"\n',
    fills: [{ '<bullet>': 'Water the beds.' }],
  },
  {
    title: 'a grant bullet with a tab',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--may', 'Water\tthe beds.', '--where', 'chat', '--reading', 'covers watering'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www grant --may "<one line>" --where chat --reading "covers watering"\n',
    fills: [{ '<one line>': 'Water the beds.' }],
  },
  {
    title: 'a grant reading with a line separator',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--where',
      'chat',
      '--reading',
      'covers\u2028watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www grant --may "Water the beds." --where chat --reading "<one line>"\n',
    fills: [{ '<one line>': 'covers watering' }],
  },
  {
    title: 'a grant where with a paragraph separator',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--where',
      'ch\u2029at',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www grant --may "Water the beds." --where "<one line>" --reading "covers watering"\n',
    fills: [{ '<one line>': 'chat' }],
  },
  {
    title: 'a claim with a line separator',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'Water\u2028the beds'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nRun: www task t-a "<one line>"\n',
    fills: [{ '<one line>': 'Water the beds' }],
  },
  {
    title: 'a grant bullet that holds the bullet mark',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'Water the beds.',
      '--never',
      'dig • spray',
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet cannot hold •, which the brief prints before each bullet.\nRun: www grant --may "Water the beds." --never "dig - spray" --where chat --reading "covers watering"\n',
    fills: [{}],
  },
  {
    title: 'a grant bullet whose bullet mark hides a credential',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      ['xoxb', '•', '12'].join(''),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet cannot hold •, which the brief prints before each bullet.\nRun: www grant --may "<bullet>" --where chat --reading "covers watering"\n',
    fills: [{ '<bullet>': 'Water the beds.' }],
  },
  {
    title: 'a dash value that holds a credential, which keeps its flag',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      `--allow ${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}`,
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: the value of --may starts with a dash, so it reads as a flag. Join the two with =, as in --may="<value>".\nRun: www grant --may "<where the secret lives>" --where chat --reading "covers watering"\n',
    fills: [{ '<where the secret lives>': 'Water the beds.' }],
  },
  {
    title: 'a dash value with a --session that has no value',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'water',
      '--never',
      '-keep',
      '--where',
      'chat',
      '--reading',
      'covers watering',
      '--session',
      '--help',
    ],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: --session needs a value.\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a dash value that spans two lines',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'water',
      '--where',
      'chat',
      '--reading',
      'covers watering',
      '--never',
      '-keep\nthe gate shut',
    ],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: the value of --never starts with a dash, so it reads as a flag. Join the two with =, as in --never="<value>".\nRun: www grant --may water --where chat --reading "covers watering" --never="-keep the gate shut"\n',
    fills: [{}],
  },
  {
    title: 'a grant of 700 characters with no --may, which has no room for one',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--not',
      'n'.repeat(100),
      ...Array.from({ length: 5 }, () => ['--not', 'n'.repeat(120)]).flat(),
      '--where',
      'chat',
      '--reading',
      'covers watering',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the grant\'s words are 701 characters in its bullets and scope, and the limit is 700.\nRun: www grant --may "<what the owner allows, in their words>" --not "<what the owner did not grant, in their words>" --where chat --reading "covers watering"\n',
    fills: [
      {
        '<what the owner allows, in their words>': 'Water.',
        '<what the owner did not grant, in their words>': 'Prune.',
      },
    ],
  },
  {
    title: 'an unknown flag that looks like a credential',
    setup: [],
    files: [],
    argv: ['goal', 'x', '--xoxb-fakesample'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: unknown flag "<where the secret lives>".\nRun: www help\n',
    fills: [{}],
  },
  {
    title: 'a session key that looks like a credential',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [
      {
        session: 'tide-alerts',
        name: 'session',
        text: `format=2\nname=tide-alerts\ngoal=Ship it\ngrant_scope=\ngrant_reading=\ngrant_where=\ngrant_set=\nstarted=2026-03-02T08:00:00Z\n${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}=pasted\n`,
      },
    ],
    argv: ['task', 't-b', 'x'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: tide-alerts's session does not parse: the key <where the secret lives> is not in format 2. Fix the file by hand.\nRun: less <STATE>/tide-alerts/session\n",
    fills: [],
  },
  {
    title: 'a format 1 session key that looks like a credential',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'session',
        text: `format=1\nname=old-notes\ngoal=Ship it\nstarted=2026-03-02T08:00:00Z\nnow=\nnow_next=\nnow_set=\nlast_write=\nlast_nudge=\n${['ghp', '_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'].join('')}=pasted\n`,
      },
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-valves\ttask\tWire the valve relay test\t-\t-\t-\t2026-03-06T09:00:00Z\tagent\t-\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      "www: old-notes's session does not parse: the key <where the secret lives> is not in format 1. Fix the file by hand.\nRun: less <STATE>/old-notes/session\n",
    fills: [],
  },
  {
    title: 'an upgrade whose older one-time approval has an id that looks like a credential',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nxoxb-fakedemo\tok\tyou can wipe the staging sensor table once\t-\t-\t-\t2026-03-05T09:00:00Z\tagent\twho=owner;where=chat;scope=staging sensor table;use=once\nok-tags\tok\tpush the garden-api tags\t-\t-\t-\t2026-03-08T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=once\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: ['import', 'old-notes'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: old-notes holds 2 one-time approvals, and format 2 holds 1. Drop all but one.\n  <where the secret lives>  "you can wipe the staging sensor table once" · staging sensor table  [5d]\n  ok-tags                   "push the garden-api tags" · garden-api  [2d]\nRun: www import old-notes --drop "<where the secret lives>"\n',
    fills: [],
  },
  {
    title: 'a grant where that looks like a credential',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--may', 'water', '--where', 'ghp_fake', '--reading', 'covers watering'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www grant --may water --where "<where the secret lives>" --reading "covers watering"\n',
    fills: [{ '<where the secret lives>': 'chat' }],
  },
  {
    title: 'a grant bullet of one bullet mark',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['grant', '--may', '•', '--where', 'chat', '--reading', 'covers watering'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the bullet cannot hold •, which the brief prints before each bullet.\nRun: www grant --may "<bullet>" --where chat --reading "covers watering"\n',
    fills: [{ '<bullet>': 'Water the beds.' }],
  },
  {
    title: 'a grant scope and reading that hold the bullet mark',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: [
      'grant',
      '--may',
      'water',
      '--scope',
      'beds\n• shed',
      '--where',
      'chat',
      '--reading',
      'works • fine',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the reading cannot hold •, which the brief prints before each bullet.\nwww: refused: the grant\'s scope cannot hold •, which the brief prints before each bullet.\nRun: www grant --may water --scope "beds - shed" --where chat --reading "works - fine"\n',
    fills: [{}],
  },
  {
    title: 'an upgrade whose bullet starts with two dashes',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-merge\tok\tmerge the garden-api PRs yourself once CI is green\t-\t-\t-\t2026-03-03T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=standing\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: [
      'import',
      'old-notes',
      '--may',
      'Merge it yourself.',
      '--never',
      '--force-push to main',
      '--where',
      'chat',
      '--reading',
      'covers merges',
    ],
    env: 'agent',
    exitCode: 2,
    stderr:
      'www: the value of --never starts with a dash, so it reads as a flag. Join the two with =, as in --never="<value>".\nRun: www import old-notes --may "Merge it yourself." --never="--force-push to main" --where chat --reading "covers merges"\n',
    fills: [{}],
  },
  {
    title: 'an upgrade whose bullet holds the bullet mark and a line separator',
    format1: 'old-notes',
    setup: [],
    files: [
      {
        session: 'old-notes',
        name: 'items.tsv',
        text: 'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nok-merge\tok\tmerge the garden-api PRs yourself once CI is green\t-\t-\t-\t2026-03-03T09:00:00Z\tagent\twho=owner;where=chat;scope=garden-api;use=standing\n',
      },
      { session: 'old-notes', name: 'notes.tsv', text: 'id\towed\twritten\tnote\n' },
    ],
    argv: [
      'import',
      'old-notes',
      '--may',
      'Merge • deploy',
      '--where',
      'chat',
      '--reading',
      'covers\u2028merges',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text must be one line, with no tab or newline.\nwww: refused: the bullet cannot hold •, which the brief prints before each bullet.\nRun: www import old-notes --may "Merge - deploy" --where chat --reading "<one line>"\n',
    fills: [{ '<one line>': 'covers merges' }],
  },
  {
    title: 'a task with the id grant',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 'grant', 'Tidy the beds'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not grant, d-<n> or o-<n>.\nRun: www task <new id> "Tidy the beds"\n',
    fills: [{ '<new id>': 't-beds' }],
  },
])('it refuses $title with its text and a Run line that passes', async (row) => {
  const ctx = setupTest();

  const envs = {
    agent: ctx.agentEnv,
    shell: { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME },
    owner: { HOME: ctx.agentEnv.HOME, XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME },
    'other-agent': { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: 'c3d4-other' },
  };

  const noTerminal = { stdin: false, stdout: false };

  const terminals = {
    agent: noTerminal,
    shell: noTerminal,
    'other-agent': noTerminal,
    owner: { stdin: true, stdout: true },
  };

  for (const setupArgv of row.setup) {
    await ctx.run(setupArgv, envs[row.setupEnv ?? 'agent'], terminals[row.setupEnv ?? 'agent']);
  }

  if (row.format1 !== undefined) {
    seedFormat1Store(ctx.stateRoot, row.format1);
  }

  for (const file of row.files) {
    seedStoreFile(join(ctx.stateRoot, file.session), file.name, file.text);
  }

  ctx.writeSnapshot();

  const before = await ctx.readTree();

  const listingBefore = ctx.readListing();

  const result = await ctx.run(row.argv, envs[row.env], terminals[row.env]);
  const after = await ctx.readTree();

  const listingAfter = ctx.readListing();
  const replayEnv = envs[row.replayEnv ?? row.env];
  const stderr = row.stderr.replaceAll('<STATE>', ctx.stateRoot);
  const runLines = result.stderr.split('\n').filter((line) => line.startsWith('Run: www'));
  const lessLines = result.stderr.split('\n').filter((line) => line.startsWith('Run: less '));
  const filledExitCodes: number[] = [];
  const lessExitCodes: number[] = [];

  for (const [index, fills] of row.fills.entries()) {
    const argv = buildFilledRunArgv(runLines[index] ?? '', fills);

    ctx.restoreStore();

    const filled = await ctx.run(argv, replayEnv, terminals[row.replayEnv ?? row.env]);

    filledExitCodes.push(filled.exitCode);
  }

  for (const line of lessLines) {
    const words = await readShellWords(line.slice('Run: '.length));

    // less prints a file as cat does when its output is no terminal, and CI hosts may lack less
    const paged = await run(['cat', ...words.slice(1)]);

    lessExitCodes.push(paged.exitCode);
  }

  expect(result).toStrictEqual({ exitCode: row.exitCode, stdout: '', stderr });
  expect(after).toStrictEqual(before);
  expect(listingAfter).toStrictEqual(listingBefore);
  expect(filledExitCodes).toStrictEqual(row.fills.map(() => 0));
  expect(lessExitCodes).toStrictEqual(lessLines.map(() => 0));
});

test('it refuses a write while another holds the lock for 2 s, names the holder, and the same line passes once it is released', async () => {
  const ctx = setupTest();
  const released = Promise.withResolvers<undefined>();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

  const holder = withStoreLock(join(ctx.stateRoot, 'tide-alerts'), () => released.promise);

  await waitFor(async () => {
    const tree = await ctx.readTree();

    expect(Object.keys(tree)).toContain('tide-alerts/lock');
  });

  const before = await ctx.readTree();
  const refused = await ctx.run(['task', 't-a', 'Write it'], ctx.agentEnv);
  const after = await ctx.readTree();

  released.resolve(undefined);

  await holder;

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const retried = await ctx.run(buildFilledRunArgv(line, {}), ctx.agentEnv);

  expect(refused).toStrictEqual({
    exitCode: 3,
    stdout: '',
    stderr: `www: refused: another write holds the lock on tide-alerts (pid ${String(process.pid)}). Try again.\nRun: www task t-a "Write it"\n`,
  });

  expect(after).toStrictEqual(before);
  expect(retried.exitCode).toBe(0);
});

test('it prints a claim with a shell redirection as one word that a real shell reads back', async () => {
  const ctx = setupTest();

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], ctx.agentEnv);

  const refused = await ctx.run(
    ['task', 't-a', 'phase>draft', '--pr', 'acme/tool#1', '--pid', '5'],
    ctx.agentEnv,
  );

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: www')) ?? '';

  const words = await readShellWords(line.slice('Run: www '.length));
  const retried = await ctx.run(words, ctx.agentEnv);

  expect({ words, retried: retried.exitCode }).toStrictEqual({
    words: ['task', 't-a', 'phase>draft', '--pr', 'acme/tool#1'],
    retried: 0,
  });
});

test('it prints the path of a broken file as one word that a real shell reads back', async () => {
  const ctx = setupTest();

  const env = {
    ...ctx.agentEnv,
    HOME: join(ctx.agentEnv.HOME, 'two words'),
    XDG_STATE_HOME: join(ctx.agentEnv.XDG_STATE_HOME, 'two words'),
  };

  const folder = join(ctx.agentEnv.XDG_STATE_HOME, 'two words', 'wherewerewe', 'tide-alerts');

  await ctx.run(['init', 'tide-alerts', '--goal', 'Ship it'], env);

  seedStoreFile(
    folder,
    'items.tsv',
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\nt-a\ttask\n',
  );

  const refused = await ctx.run(['task', 't-b', 'x'], env);

  const line = refused.stderr.split('\n').find((text) => text.startsWith('Run: less')) ?? '';

  const words = await readShellWords(line.slice('Run: '.length));

  expect(words).toStrictEqual(['less', join(folder, 'items.tsv')]);
});
