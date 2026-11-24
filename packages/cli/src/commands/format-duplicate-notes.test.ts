import { expect, test } from 'bun:test';
import { buildMockItem } from '../test-utils/build-mock-item.ts';
import { buildMockStore } from '../test-utils/build-mock-store.ts';
import { formatDuplicateNotes } from './format-duplicate-notes.ts';

function setupTest() {
  const lesson = {
    id: 'l-seed',
    text: 'x',
    why: 'y',
    written: '2026-03-07T15:20:44Z',
    by: 'agent',
  } as const;

  return {
    format: (folder: string) =>
      formatDuplicateNotes(
        buildMockStore({
          folder,
          items: [buildMockItem({ id: 'l-seed' }), buildMockItem({ id: 't-a' })],
          lessons: [lesson],
        }),
      ),
    formatClean: () =>
      formatDuplicateNotes(buildMockStore({ items: [buildMockItem({ id: 't-a' })] })),
  };
}

test('it names an id held in two files once, with the file of the second holder', () => {
  const ctx = setupTest();

  expect(ctx.format('/state/wherewerewe/tide-alerts')).toBe(
    'www: tide-alerts holds l-seed twice, as a task in items.tsv and as a lesson in lessons.tsv. Rename one of them by hand; the journal keeps both.\nRun: less /state/wherewerewe/tide-alerts/lessons.tsv\n',
  );
});

test('it quotes a store path with a space so the shell reads it as one word', () => {
  const ctx = setupTest();

  expect(ctx.format('/state with space/session')).toContain(
    'Run: less "/state with space/session/lessons.tsv"\n',
  );
});

test('it prints nothing for a store that holds each id once', () => {
  const ctx = setupTest();

  expect(ctx.formatClean()).toBe('');
});
