import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { resolveSession } from './resolve-session.ts';
import { writeBinding } from './write-binding.ts';

function setupTest() {
  return { root: join(createTempDir('resolve-session').path, 'wherewerewe') };
}

test('it takes the --session flag before every other rule', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'bound-notes');

  const resolved = await resolveSession({
    flag: 'flag-notes',
    env: { WHEREWEREWE_SESSION: 'env-notes', CLAUDE_CODE_SESSION_ID: 'a1' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'found',
    name: 'flag-notes',
    via: 'flag',
    agent: { harness: 'claude', id: 'a1' },
  });
});

test('it takes WHEREWEREWE_SESSION before a binding', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'bound-notes');

  const resolved = await resolveSession({
    flag: null,
    env: { WHEREWEREWE_SESSION: 'env-notes', CLAUDE_CODE_SESSION_ID: 'a1' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'found',
    name: 'env-notes',
    via: 'env',
    agent: { harness: 'claude', id: 'a1' },
  });
});

test('it takes the Claude binding before the Codex binding', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'claude-notes');
  await writeBinding(ctx.root, { harness: 'codex', id: 'c1' }, 'codex-notes');

  const resolved = await resolveSession({
    flag: null,
    env: { CLAUDE_CODE_SESSION_ID: 'a1', CODEX_SESSION_ID: 'c1' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'found',
    name: 'claude-notes',
    via: 'binding',
    agent: { harness: 'claude', id: 'a1' },
  });
});

test('it falls through a missing Claude binding to the Codex thread binding', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'codex', id: 't9' }, 'codex-notes');

  const resolved = await resolveSession({
    flag: null,
    env: { CLAUDE_CODE_SESSION_ID: 'a1', CODEX_THREAD_ID: 't9' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'found',
    name: 'codex-notes',
    via: 'binding',
    agent: { harness: 'claude', id: 'a1' },
  });
});

test('it skips an empty flag and an empty variable', async () => {
  const ctx = setupTest();

  await writeBinding(ctx.root, { harness: 'claude', id: 'a1' }, 'bound-notes');

  const resolved = await resolveSession({
    flag: '',
    env: { WHEREWEREWE_SESSION: '', CLAUDE_CODE_SESSION_ID: 'a1' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'found',
    name: 'bound-notes',
    via: 'binding',
    agent: { harness: 'claude', id: 'a1' },
  });
});

test('it finds no session even when exactly one session folder exists', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'only-notes');

  const resolved = await resolveSession({
    flag: null,
    env: { CLAUDE_CODE_SESSION_ID: 'a1' },
    root: ctx.root,
  });

  expect(resolved).toStrictEqual({
    kind: 'none',
    named: null,
    agent: { harness: 'claude', id: 'a1' },
  });
});
