import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
import { readShellWords } from '../test-utils/read-shell-words.ts';
import { readTreeHashes } from '../test-utils/read-tree-hashes.ts';
import { seedStoreFile } from '../test-utils/seed-store-file.ts';

function setupTest() {
  const root = createTempDir('refusals').path;
  const clock = { nowMs: Date.parse('2026-03-10T11:43:00Z') };

  return {
    stateRoot: join(root, 'wherewerewe'),
    agentEnv: { XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' },
    run: (argv: readonly string[], env: Record<string, string | undefined>) =>
      runCLI({
        argv,
        env,
        cwd: '/work',
        now: () => {
          clock.nowMs += 1000;

          return clock.nowMs - 1000;
        },
      }),
    readTree: () => readTreeHashes(join(root, 'wherewerewe')),
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
      'www: refused: the claim is 152 characters, and the limit is 120. Write what is true now; the story belongs in a PR or a commit.\nRun: www task t-e2e "<claim of at most 120 characters>"\n',
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
      'www: refused: the next step is 121 characters, and the limit is 120. Write what is true now; the story belongs in a PR or a commit.\nRun: www now t-a "<next step of at most 120 characters>"\n',
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
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not d-<n> or o-<n>.\nRun: www task t-one x\n',
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
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not d-<n> or o-<n>.\nRun: www task <new id> x\n',
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
      'www: refused: the text looks like a credential (it matches ghp_). Write where the secret lives, never its value.\nRun: www goal "<text with no secret in it>"\n',
    fills: [{ '<text with no secret in it>': 'Ship it' }],
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www done t-a --evidence "<text with no secret in it>"\n',
    fills: [{ '<text with no secret in it>': 'commit 4c1d2e0' }],
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
    title: 'an import of a store that is format 1 already, with an agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['import', 'tide-alerts'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: tide-alerts is already format 1. Bind this agent session to it.\nRun: www attach tide-alerts\n',
    fills: [{}],
  },
  {
    title: 'an import of a store that is format 1 already, with no agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['import', 'tide-alerts'],
    env: 'shell',
    exitCode: 3,
    stderr: 'www: refused: tide-alerts is already format 1.\nRun: www --session tide-alerts\n',
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
    files: [{ session: 'old-notes', name: 'session', text: 'format=2\n' }],
    argv: ['--session', 'old-notes'],
    env: 'agent',
    exitCode: 5,
    stderr:
      'www: old-notes is format 2, and this www reads format 1.\nRun: bun add -g @wherewerewe/cli@latest\n',
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
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-a --quote "<their exact words>" --who "<who>" --where "<where>" --scope "<what it covers>" "<--once or --standing>"\n',
    fills: [
      {
        '<their exact words>': 'merge yourself',
        '<who>': 'owner',
        '<where>': 'chat',
        '<what it covers>': 'bosun-api',
        '<--once or --standing>': '--once',
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
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --once --scope "<what it covers>"\n',
    fills: [{ '<what it covers>': 'bosun-api' }],
  },
  {
    title: 'an approval with both --once and --standing',
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
      '--once',
      '--standing',
    ],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope bosun-api "<--once or --standing>"\n',
    fills: [{ '<--once or --standing>': '--standing' }],
  },
  {
    title: 'an approval with neither --once nor --standing, and no quote',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['ok', 'ok-a', '--who', 'owner', '--where', 'chat', '--scope', 'bosun-api'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-a --who owner --where chat --scope bosun-api --quote "<their exact words>" "<--once or --standing>"\n',
    fills: [{ '<their exact words>': 'merge yourself', '<--once or --standing>': '--once' }],
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
      'www: refused: the quote is 121 characters, and the limit is 120. Write what is true now; the story belongs in a PR or a commit.\nRun: www ok ok-a --quote "<quote of at most 120 characters>" --who owner --where chat --scope bosun-api --once\n',
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www ok ok-a --quote "<text with no secret in it>" --who owner --where chat --scope bosun-api --once\n',
    fills: [{ '<text with no secret in it>': 'merge yourself' }],
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope "<text with no secret in it>" --once\n',
    fills: [{ '<text with no secret in it>': 'bosun-api' }],
  },
  {
    title: 'a full set of approvals',
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
      [
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
        '--once',
      ],
      [
        'ok',
        'ok-c',
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
    argv: [
      'ok',
      'ok-d',
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
      'www: refused: the brief holds 3 of 3 approvals. Close one, or replace one with www set.\nRun: www drop ok-a --why "<reason>"\n',
    fills: [{ '<reason>': 'no longer needed' }],
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
      'www: refused: an id is 2 to 16 characters of a-z, 0-9 and -, starts with a letter, and is not d-<n> or o-<n>.\nRun: www ok ok-a --quote "merge yourself" --who owner --where chat --scope bosun-api --once\n',
    fills: [{}],
  },
  {
    title: 'use on a standing approval',
    setup: [
      ['init', 'tide-alerts', '--goal', 'Ship it'],
      [
        'ok',
        'ok-merge',
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
    ],
    files: [],
    argv: ['use', 'ok-merge', '--for', 'merged it'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: ok-merge is standing, so there is nothing to spend. Act inside its quote and scope.\nRun: www show ok-merge\n',
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
      'www: refused: t-a is a task, and use spends a --once approval.\nRun: www done t-a --evidence "<PR, commit or test run>"\n',
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
      'www: refused: r-a is a rule, and use spends a --once approval.\nRun: www done r-a --evidence "<PR, commit or test run>"\n',
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www use ok-a --for "<text with no secret in it>"\n',
    fills: [{ '<text with no secret in it>': 'merged it' }],
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "<text with no secret in it>" --why "The feed flaps"\n',
    fills: [{ '<text with no secret in it>': 'Retry a 503 3 times' }],
  },
  {
    title: 'a credential in a decision reason',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['decide', 'Retry a 503 3 times', '--why', `AKIA${'Q'.repeat(16)}`],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "Retry a 503 3 times" --why "<text with no secret in it>"\n',
    fills: [{ '<text with no secret in it>': 'The feed flaps' }],
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
      'www: refused: d-1 is the owner\'s decision. Ask the owner, and record the answer with --who owner.\nRun: www decide "<the owner\'s answer>" --why "<reason>" --who owner --replaces d-1\n',
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
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-a --quote "<text with no secret in it>" --who owner --where chat --once --scope "<what it covers>"\n',
    fills: [{ '<text with no secret in it>': 'merge yourself', '<what it covers>': 'bosun-api' }],
  },
  {
    title: 'an approval that lacks a part, with a quote that starts with two dashes',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['ok', 'ok-b', '--quote=--preview', '--where', 'chat', '--scope', 'tests', '--once'],
    env: 'agent',
    exitCode: 3,
    stderr:
      'www: refused: an approval needs the owner\'s exact words, who gave them, where, what they cover, and --once or --standing.\nRun: www ok ok-b --quote=--preview --where chat --scope tests --once --who "<who>"\n',
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
      'www: refused: the text looks like a credential (it matches AKIA). Write where the secret lives, never its value.\nRun: www decide "<text with no secret in it>" --why "<text with no secret in it>"\n',
    fills: [{ '<text with no secret in it>': 'Retry a 503 3 times' }],
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
      'www: refused: there is no decision <text with no secret in it>; there are no decisions yet.\nRun: www log --op decide,ruled-out\n',
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
])('it refuses $title with its text and a Run line that passes', async (row) => {
  const ctx = setupTest();

  const envs = {
    agent: ctx.agentEnv,
    shell: { XDG_STATE_HOME: ctx.agentEnv.XDG_STATE_HOME },
    'other-agent': { ...ctx.agentEnv, CLAUDE_CODE_SESSION_ID: 'c3d4-other' },
  };

  for (const setupArgv of row.setup) {
    await ctx.run(setupArgv, ctx.agentEnv);
  }

  for (const file of row.files) {
    seedStoreFile(join(ctx.stateRoot, file.session), file.name, file.text);
  }

  const before = await ctx.readTree();
  const result = await ctx.run(row.argv, envs[row.env]);
  const after = await ctx.readTree();

  const replayEnv = envs[row.replayEnv ?? row.env];
  const stderr = row.stderr.replaceAll('<STATE>', ctx.stateRoot);
  const runLines = result.stderr.split('\n').filter((line) => line.startsWith('Run: www'));
  const filledExitCodes: number[] = [];

  for (const [index, fills] of row.fills.entries()) {
    const argv = buildFilledRunArgv(runLines[index] ?? '', fills);

    const filled = await ctx.run(argv, replayEnv);

    filledExitCodes.push(filled.exitCode);
  }

  expect(result).toStrictEqual({ exitCode: row.exitCode, stdout: '', stderr });
  expect(after).toStrictEqual(before);
  expect(filledExitCodes).toStrictEqual(row.fills.map(() => 0));
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
  const env = { ...ctx.agentEnv, XDG_STATE_HOME: join(ctx.agentEnv.XDG_STATE_HOME, 'two words') };
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
