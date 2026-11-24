import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedDayNineStore } from './seed-day-nine-store.ts';

test('it seeds the session of day 9 with its items, owner notes, saved results and pull request row', async () => {
  const store = await seedDayNineStore(createTempDir('day-nine').path);
  const read = await readStore(join(store.stateRoot, 'tide-alerts'));

  expect(
    read.kind === 'store' && [
      read.store.items.map((item) => item.id),
      read.store.ownerNotes.map((note) => note.id),
      read.store.prs.map((row) => row.ref),
      read.store.session.now,
    ],
  ).toStrictEqual([
    [
      'r-api-tests',
      'r-tk-fork',
      'r-sim-port',
      't-e2e',
      'w-apns',
      't-flag',
      'pr-app-61',
      'pr-api-77',
      'pr-tk-19',
      'w-tk',
      'wt-tz',
      'p-sim',
      's-staging',
      'ok-prod-index',
    ],
    ['o-2', 'o-3'],
    ['bosunhq/bosun-app#64'],
    'pr-api-77',
  ]);
});
