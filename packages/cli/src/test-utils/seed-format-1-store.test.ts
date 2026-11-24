import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { findFormat } from '../import/find-format.ts';
import { seedFormat1Store } from './seed-format-1-store.ts';

function setupTest() {
  return { root: createTempDir('seed-format-1').path };
}

test('it copies the format 1 store into a folder of the given name and returns the folder', () => {
  const ctx = setupTest();
  const folder = seedFormat1Store(ctx.root, 'garden-beds');
  const session = readFileSync(join(folder, 'session'), 'utf8');

  expect({
    folder,
    files: readdirSync(folder).toSorted(),
    format: findFormat(session),
    name: session.includes('name=garden-beds\n'),
  }).toStrictEqual({
    folder: join(ctx.root, 'garden-beds'),
    files: ['items.tsv', 'journal.tsv', 'notes.tsv', 'owner.tsv', 'prs.tsv', 'session'],
    format: '1',
    name: true,
  });
});

test('it holds two standing approvals, one one-time approval and a note on a standing one', () => {
  const ctx = setupTest();
  const folder = seedFormat1Store(ctx.root, 'garden-beds');
  const items = readFileSync(join(folder, 'items.tsv'), 'utf8');
  const notes = readFileSync(join(folder, 'notes.tsv'), 'utf8');

  expect({
    standing: items.match(/use=standing/gu)?.length,
    once: items.match(/use=once/gu)?.length,
    noteOn: notes.split('\n')[1]?.split('\t')[0],
  }).toStrictEqual({ standing: 2, once: 1, noteOn: 'ok-merge' });
});
