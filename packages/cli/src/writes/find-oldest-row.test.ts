import { expect, test } from 'bun:test';
import { findOldestRow } from './find-oldest-row.ts';

function setupTest() {
  return { pick: findOldestRow };
}

interface Case {
  readonly title: string;
  readonly rows: readonly { readonly id: string; readonly written: string }[];
  readonly oldest: { readonly id: string; readonly written: string } | undefined;
}

test.each<Case>([
  { title: 'no row', rows: [], oldest: undefined },
  {
    title: 'a first row that a replacement made the newest',
    rows: [
      { id: 'a', written: '2026-03-09T09:00:00Z' },
      { id: 'b', written: '2026-03-04T09:00:00Z' },
    ],
    oldest: { id: 'b', written: '2026-03-04T09:00:00Z' },
  },
  {
    title: 'two rows of one time, the first of the file',
    rows: [
      { id: 'a', written: '2026-03-04T09:00:00Z' },
      { id: 'b', written: '2026-03-04T09:00:00Z' },
    ],
    oldest: { id: 'a', written: '2026-03-04T09:00:00Z' },
  },
])('it finds the oldest row of $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.rows)).toStrictEqual(row.oldest);
});
