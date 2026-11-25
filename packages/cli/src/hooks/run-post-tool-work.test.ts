import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readBinding } from '../sessions/read-binding.ts';
import { buildHookContext } from '../test-utils/build-hook-context.ts';
import { seedHookStore } from '../test-utils/seed-hook-store.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { pickPostToolWork } from './pick-post-tool-work.ts';
import { runPostToolWork } from './run-post-tool-work.ts';

function setupTest() {
  const root = createTempDir('run-post-tool-work').path;
  const context = buildHookContext(root);

  return {
    root,
    createBoundStore: () =>
      seedHookStore(root, { harness: 'claude', id: '9e1f-trial' }, 'tide-alerts'),
    createStore: () => seedSessionStore(root, 'tide-alerts'),
    run: (name: string | null, command: string, response: string) =>
      runPostToolWork(
        context,
        { harness: 'claude', sessionID: '9e1f-trial', name },
        pickPostToolWork(command, response, 'claude'),
      ),
    readFile: (folder: string, file: string) => readFileSync(join(folder, file), 'utf8'),
    readBound: () => readBinding(root, { harness: 'claude', id: '9e1f-trial' }),
  };
}

test('it binds the session id after an init of a session whose store exists, with one bind row', async () => {
  const ctx = setupTest();

  const folder = await ctx.createStore();

  await ctx.run(null, 'www attach tide-alerts', '');
  await ctx.run(null, 'www attach tide-alerts', '');

  const bound = await ctx.readBound();

  expect({
    bound,
    rows: ctx
      .readFile(folder, 'journal.tsv')
      .split('\n')
      .filter((line) => line.includes('\tbind\t')),
  }).toStrictEqual({
    bound: 'tide-alerts',
    rows: [
      '2026-03-10T11:43:00Z\tbind\ttide-alerts\thook\tattach\t-\tharness=claude;agent=9e1f-trial',
    ],
  });
});

test('it binds nothing for a session whose store is missing', async () => {
  const ctx = setupTest();

  await ctx.run(null, 'www attach tide-alerts', '');

  const bound = await ctx.readBound();

  expect(bound).toBeNull();
});

test('it records the first pull request address once, with a pr row', async () => {
  const ctx = setupTest();

  const folder = await ctx.createBoundStore();

  const response = 'https://github.com/bosunhq/bosun-api/pull/77\n';

  await ctx.run('tide-alerts', 'gh pr create --fill', response);
  await ctx.run('tide-alerts', 'gh pr create --fill', response);

  expect({
    prs: ctx.readFile(folder, 'prs.tsv'),
    rows: ctx
      .readFile(folder, 'journal.tsv')
      .split('\n')
      .filter((line) => line.includes('\tpr\t')),
  }).toStrictEqual({
    prs: 'ref\topened\tstate\tseen\nbosunhq/bosun-api#77\t2026-03-10T11:43:00Z\t-\t-\n',
    rows: ['2026-03-10T11:43:00Z\tpr\tbosunhq/bosun-api#77\thook\t-\t-\t-'],
  });
});

test('it returns the nudge after a push and sets last_nudge, then none within 20 minutes', async () => {
  const ctx = setupTest();

  const folder = await ctx.createBoundStore();
  const first = await ctx.run('tide-alerts', 'git push origin tide-fix', '');
  const second = await ctx.run('tide-alerts', 'git push origin tide-fix', '');

  expect({
    first,
    second,
    nudged: ctx.readFile(folder, 'session').includes('last_nudge=2026-03-10T11:43:00Z'),
  }).toStrictEqual({
    first:
      'wherewerewe: you pushed or merged, and the last write to tide-alerts was 8d ago. Record it: www set <id> "<claim>" or www done <id> --evidence "<PR or commit>"',
    second: null,
    nudged: true,
  });
});

test('it records and nudges nothing for an unbound id', async () => {
  const ctx = setupTest();

  const folder = await ctx.createStore();
  const nudge = await ctx.run(null, 'git push', '');

  expect({
    nudge,
    nudged: ctx.readFile(folder, 'session').includes('last_nudge=\n'),
  }).toStrictEqual({
    nudge: null,
    nudged: true,
  });
});

test('it nudges nothing for a command that is not a push, a create or a merge', async () => {
  const ctx = setupTest();

  await ctx.createBoundStore();

  const nudge = await ctx.run('tide-alerts', 'git status', '');

  expect(nudge).toBeNull();
});
