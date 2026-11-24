import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import { formatDuplicateNotes } from './format-duplicate-notes.ts';

test('it names an id held in two files once, with the file of the second holder', () => {
  const text = formatDuplicateNotes(
    buildMockStore({
      items: [buildMockItem({ id: 'l-seed' }), buildMockItem({ id: 't-a' })],
      lessons: [
        { id: 'l-seed', text: 'x', why: 'y', written: '2026-03-07T15:20:44Z', by: 'agent' },
      ],
    }),
  );

  expect(text).toBe(
    'www: tide-alerts holds l-seed twice, as a task in items.tsv and as a lesson in lessons.tsv. Rename one of them by hand; the journal keeps both.\nRun: less /state/wherewerewe/tide-alerts/lessons.tsv\n',
  );
});

test('it prints nothing for a store that holds each id once', () => {
  const store = buildMockStore({ items: [buildMockItem({ id: 't-a' })] });

  expect(formatDuplicateNotes(store)).toBe('');
});
