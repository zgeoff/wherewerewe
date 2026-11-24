import { expect, test } from 'bun:test';
import { buildMockNote } from './build-mock-note.ts';

test('it lays the named fields over a note that is not owed', () => {
  expect(buildMockNote({ id: 't-a', owed: true })).toStrictEqual({
    id: 't-a',
    owed: true,
    written: '2026-03-10T10:43:00Z',
    note: 'The simulator is shared on Fridays',
  });
});
