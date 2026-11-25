import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { seedJournalRow } from '../test-utils/seed-journal-row.ts';
import { seedSessionStore } from '../test-utils/seed-session-store.ts';
import { readJournalIndex } from './read-journal-index.ts';

function setupTest() {
  const root = createTempDir('journal-index').path;

  return { root, folder: join(root, 'tide-alerts') };
}

test('it finds each id that a done, drop or use row closed, with the ts of that row', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'task', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-04T08:00:00Z', op: 'done', id: 't-a' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-05T08:00:00Z', op: 'drop', id: 'w-b' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-06T08:00:00Z', op: 'use', id: 'ok-c' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-07T08:00:00Z', op: 'set', id: 't-d' });

  const index = await readJournalIndex(ctx.folder);

  expect(index.closed).toStrictEqual(
    new Map([
      ['t-a', '2026-03-04T08:00:00Z'],
      ['w-b', '2026-03-05T08:00:00Z'],
      ['ok-c', '2026-03-06T08:00:00Z'],
    ]),
  );
});

test('it keeps the latest close row of an id, with its op, text and kind', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'done',
    id: 'l-seed',
    text: 'An old task',
  });

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-08T08:00:00Z',
    op: 'drop',
    id: 'l-seed',
    text: null,
  });

  const index = await readJournalIndex(ctx.folder);

  expect(index.closeRows).toStrictEqual(
    new Map([['l-seed', { ts: '2026-03-08T08:00:00Z', op: 'drop', text: null, kind: null }]]),
  );
});

test('it reads the kind of the close row of a lesson', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-08T08:00:00Z',
    op: 'drop',
    id: 'l-seed',
    text: 'Pin the clock',
    extra: 'kind=lesson',
  });

  const index = await readJournalIndex(ctx.folder);

  expect(index.closeRows).toStrictEqual(
    new Map([
      ['l-seed', { ts: '2026-03-08T08:00:00Z', op: 'drop', text: 'Pin the clock', kind: 'lesson' }],
    ]),
  );
});

test('it finds each decision with who made it, and the highest decision number', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-03T08:00:00Z',
    op: 'decide',
    id: 'd-2',
    extra: 'on=t-a;who=owner',
  });

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'ruled-out',
    id: 'd-12',
    extra: 'who=agent;replaces=d-2',
  });

  await seedJournalRow(ctx.folder, { ts: '2026-03-05T08:00:00Z', op: 'decide', id: 'd-7' });
  await seedJournalRow(ctx.folder, { ts: '2026-03-06T08:00:00Z', op: 'say', id: 'd-40' });

  const index = await readJournalIndex(ctx.folder);

  expect({ decisions: index.decisions, last: index.lastDecisionNumber }).toStrictEqual({
    decisions: new Map([
      ['d-2', { who: 'owner' }],
      ['d-12', { who: 'agent' }],
      ['d-7', { who: null }],
    ]),
    last: 12,
  });
});

test('it reads no decision from a journal that has none', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'task', id: 't-a' });

  const index = await readJournalIndex(ctx.folder);

  expect({ decisions: index.decisions, last: index.lastDecisionNumber }).toStrictEqual({
    decisions: new Map(),
    last: 0,
  });
});

test('it finds nothing when the session has no journal file yet', async () => {
  const ctx = setupTest();

  const index = await readJournalIndex(ctx.folder);

  expect(index.closed).toStrictEqual(new Map());
});

test('it counts no decision number that is too large to add one to', async () => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');
  await seedJournalRow(ctx.folder, { ts: '2026-03-03T08:00:00Z', op: 'decide', id: 'd-3' });

  await seedJournalRow(ctx.folder, {
    ts: '2026-03-04T08:00:00Z',
    op: 'decide',
    id: 'd-9007199254740992',
  });

  const index = await readJournalIndex(ctx.folder);

  expect({ decisions: [...index.decisions.keys()], last: index.lastDecisionNumber }).toStrictEqual({
    decisions: ['d-3'],
    last: 3,
  });
});

test.each([
  {
    title: 'a say by import and a say by the owner',
    rows: [
      { ts: '2026-03-03T08:00:00Z', op: 'say', id: 'o-1', by: 'import' },
      { ts: '2026-03-04T08:00:00Z', op: 'say', id: 'o-3', by: 'owner' },
      { ts: '2026-03-05T08:00:00Z', op: 'ack', id: 'o-9', by: 'owner' },
      { ts: '2026-03-06T08:00:00Z', op: 'say', id: 'x-7', by: 'owner' },
    ],
    expected: 3,
  },
  {
    title: 'no say row',
    rows: [{ ts: '2026-03-05T08:00:00Z', op: 'ack', id: 'o-9', by: 'owner' }],
    expected: 0,
  },
])('it finds the highest owner note number for $title', async (row) => {
  const ctx = setupTest();

  await seedSessionStore(ctx.root, 'tide-alerts');

  for (const journalRow of row.rows) {
    await seedJournalRow(ctx.folder, journalRow);
  }

  const index = await readJournalIndex(ctx.folder);

  expect(index.lastOwnerNoteNumber).toBe(row.expected);
});
