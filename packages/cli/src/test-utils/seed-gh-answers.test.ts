import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { probePullRequest } from '../checks/probe-pull-request.ts';
import { createKillSet, runCommand } from '../checks/run-command.ts';
import { seedGhAnswers } from './seed-gh-answers.ts';

test('it answers each pull request with its result, and reads another as not found', async () => {
  const folder = createTempDir('gh-answers').path;

  seedGhAnswers(folder, {
    'bosunhq/bosun-api#77': 'OPEN failing',
    'bosunhq/bosun-app#61': 'MERGED',
  });

  const run = (argv: readonly [string, ...string[]], timeoutMs: number) =>
    runCommand(argv, {
      env: { PATH: folder },
      cwd: join(folder, 'work'),
      timeoutMs,
      kills: createKillSet(),
    });

  const failing = await probePullRequest({ repo: 'bosunhq/bosun-api', number: '77' }, run);
  const merged = await probePullRequest({ repo: 'bosunhq/bosun-app', number: '61' }, run);
  const other = await probePullRequest({ repo: 'bosunhq/bosun-app', number: '5' }, run);

  expect([failing.result, merged.result, other.result]).toStrictEqual([
    { kind: 'result', result: 'OPEN failing' },
    { kind: 'result', result: 'MERGED' },
    { kind: 'result', result: 'not found' },
  ]);
});

test('it refuses a result it holds no view for', () => {
  const folder = createTempDir('gh-answers-refuse').path;

  expect(() => seedGhAnswers(folder, { 'bosunhq/bosun-api#77': 'wobbling' })).toThrow();
});
