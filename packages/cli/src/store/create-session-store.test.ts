import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { createSessionStore } from './create-session-store.ts';

function setupTest() {
  const root = join(createTempDir('create-store').path, 'wherewerewe');

  return {
    root,
    session: {
      format: '1',
      name: 'tide-alerts',
      goal: 'Ship it',
      started: '2026-03-02T08:04:11Z',
      now: null,
      nowNext: null,
      nowSet: null,
      lastWrite: null,
      lastNudge: null,
      importedFrom: null,
    } as const,
    row: {
      ts: '2026-03-02T08:04:11Z',
      op: 'init',
      id: 'tide-alerts',
      by: 'agent',
      text: 'Ship it',
      why: null,
      extra: null,
    } as const,
  };
}

test('it makes the folder with its five files and no lock', async () => {
  const ctx = setupTest();

  const result = await createSessionStore(ctx.root, ctx.session, [ctx.row]);

  expect(result).toBe('created');

  expect(readdirSync(join(ctx.root, 'tide-alerts')).toSorted()).toStrictEqual([
    'items.tsv',
    'journal.tsv',
    'owner.tsv',
    'prs.tsv',
    'session',
  ]);
});

test('it writes each tsv with its header row and the journal with the given rows', async () => {
  const ctx = setupTest();

  await createSessionStore(ctx.root, ctx.session, [ctx.row]);

  const folder = join(ctx.root, 'tide-alerts');

  expect([
    readFileSync(join(folder, 'items.tsv'), 'utf8'),
    readFileSync(join(folder, 'owner.tsv'), 'utf8'),
    readFileSync(join(folder, 'prs.tsv'), 'utf8'),
    readFileSync(join(folder, 'journal.tsv'), 'utf8'),
  ]).toStrictEqual([
    'id\tkind\tclaim\tcheck\tat_write\tlast\twritten\tby\textra\n',
    'id\ttext\tsaid\ton\n',
    'ref\topened\tstate\tseen\n',
    'ts\top\tid\tby\ttext\twhy\textra\n2026-03-02T08:04:11Z\tinit\ttide-alerts\tagent\tShip it\t-\t-\n',
  ]);
});

test('it answers exists the second time', async () => {
  const ctx = setupTest();

  await createSessionStore(ctx.root, ctx.session, [ctx.row]);

  const result = await createSessionStore(ctx.root, ctx.session, [ctx.row]);

  expect(result).toBe('exists');
});
