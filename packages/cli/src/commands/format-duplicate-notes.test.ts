import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import { formatDuplicateNotes } from './format-duplicate-notes.ts';

function setupTest() {
  return { format: formatDuplicateNotes };
}

test('it names an id held in two files once, with the file of the second holder', () => {
  const ctx = setupTest();

  const text = ctx.format(
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

test('it quotes a store path with a space so the shell reads it as one word', () => {
  const ctx = setupTest();

  const text = ctx.format(
    buildMockStore({
      folder: '/state with space/session',
      items: [buildMockItem({ id: 'l-seed' })],
      lessons: [
        { id: 'l-seed', text: 'x', why: 'y', written: '2026-03-07T15:20:44Z', by: 'agent' },
      ],
    }),
  );

  expect(text).toBe(
    'www: tide-alerts holds l-seed twice, as a task in items.tsv and as a lesson in lessons.tsv. Rename one of them by hand; the journal keeps both.\nRun: less "/state with space/session/lessons.tsv"\n',
  );
});

test('it prints nothing for a store that holds each id once', () => {
  const ctx = setupTest();
  const store = buildMockStore({ items: [buildMockItem({ id: 't-a' })] });

  expect(ctx.format(store)).toBe('');
});
