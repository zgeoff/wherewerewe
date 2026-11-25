import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runCLI } from '../run-cli.ts';
import { readStore } from '../store/read-store.ts';
import { seedWorstCaseStore } from './seed-worst-case-store.ts';

function setupTest() {
  return { seedWorstCaseStore };
}

test('it seeds the tasks, waits, approval, rules and where items, and the lessons, promises and words of the worst case', async () => {
  const ctx = setupTest();
  const root = createTempDir('seed-worst-case').path;
  const env = { HOME: root, XDG_STATE_HOME: root, CLAUDE_CODE_SESSION_ID: 'a1b2-test' };

  const runAsAgent = (argv: readonly string[]) =>
    runCLI({
      argv,
      env,
      cwd: '/work',
      terminal: { stdin: false, stdout: false },
      now: () => Date.parse('2026-03-10T11:43:00Z'),
    });

  await ctx.seedWorstCaseStore(runAsAgent, join(root, 'wherewerewe'), 'tide-alerts', {
    taskCount: 7,
  });

  const read = await readStore(join(root, 'wherewerewe', 'tide-alerts'));

  const kinds = read.kind === 'store' ? read.store.items.map((item) => item.kind) : [];

  expect({
    task: kinds.filter((kind) => kind === 'task').length,
    wait: kinds.filter((kind) => kind === 'wait').length,
    ok: kinds.filter((kind) => kind === 'ok').length,
    rule: kinds.filter((kind) => kind === 'rule').length,
    where: kinds.filter((kind) => kind === 'where').length,
    rows:
      read.kind === 'store'
        ? [read.store.lessons.length, read.store.promises.length, read.store.words.length]
        : [],
  }).toStrictEqual({
    task: 7,
    wait: 8,
    ok: 1,
    rule: 15,
    where: 8,
    rows: [5, 5, 8],
  });
});
