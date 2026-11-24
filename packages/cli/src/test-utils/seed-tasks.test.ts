import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { seedSessionStore } from './seed-session-store.ts';
import { seedTasks } from './seed-tasks.ts';

test('it adds the tasks as open items', async () => {
  const root = createTempDir('seed-tasks').path;

  const folder = await seedSessionStore(root, 'tide-alerts');

  await seedTasks(folder, 3);

  const read = await readStore(folder);

  const ids = read.kind === 'store' ? read.store.items.map((item) => item.id) : [];

  expect(ids).toStrictEqual(['t-01xxxxxxxxxxxx', 't-02xxxxxxxxxxxx', 't-03xxxxxxxxxxxx']);
});
