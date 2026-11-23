import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { waitFor } from '@zgeoff/testing';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { withStoreLock } from '../store/with-store-lock.ts';
import { buildFilledRunArgv } from '../test-utils/build-filled-run-argv.ts';
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
    argv: ['done', 't-a', '--evidence', 'AKIAABCDEFGHIJKLMNOP'],
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
    title: 'an init of a session that exists, with no agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['init', 'tide-alerts', '--goal', 'Other'],
    env: 'shell',
    exitCode: 3,
    stderr:
      'www: refused: session tide-alerts exists. Bind this agent session to it.\nRun: www --session tide-alerts\n',
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
      'www: refused: this shell has no agent session id (no CLAUDE_CODE_SESSION_ID or CODEX_SESSION_ID). Name the session on each command.\nRun: www sessions\n',
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
    title: 'no session for a shell with no agent id',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['task', 't-a', 'x'],
    env: 'shell',
    exitCode: 4,
    stderr:
      'www: no session for this agent. Sessions on this machine: tide-alerts (day 1).\nRun: www --session <name> task t-a x\nRun: www init <name> --goal "<what done means>"\n',
    fills: [{ '<name>': 'tide-alerts' }, { '<name>': 'new-notes', '<what done means>': 'Ship it' }],
  },
  {
    title: 'a --session that names a missing session',
    setup: [['init', 'tide-alerts', '--goal', 'Ship it']],
    files: [],
    argv: ['--session', 'nope-notes', 'task', 't-a', 'x'],
    env: 'shell',
    exitCode: 4,
    stderr:
      'www: no session nope-notes on this machine. Sessions on this machine: tide-alerts (day 1).\nRun: www --session <name> task t-a x\nRun: www init <name> --goal "<what done means>"\n',
    fills: [{ '<name>': 'tide-alerts' }, { '<name>': 'new-notes', '<what done means>': 'Ship it' }],
  },
  {
    title: 'a hand-kept store (its Run line needs import, which slice 1c adds)',
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
      'www: old-notes is a hand-kept store (format 0-by-hand). Convert it first.\nRun: www import old-notes\n',
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
    argv: [],
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
    argv: ['ok', 'ok-a'],
    env: 'agent',
    exitCode: 2,
    stderr: 'www: "ok" comes in a later version of www.\nRun: www help\n',
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

  const stderr = row.stderr.replaceAll('<STATE>', ctx.stateRoot);
  const runLines = result.stderr.split('\n').filter((line) => line.startsWith('Run: www'));
  const filledExitCodes: number[] = [];

  for (const [index, fills] of row.fills.entries()) {
    const argv = buildFilledRunArgv(runLines[index] ?? '', fills);

    const filled = await ctx.run(argv, envs[row.env]);

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
