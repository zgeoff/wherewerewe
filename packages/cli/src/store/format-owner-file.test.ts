import { expect, test } from 'bun:test';
import { formatOwnerFile } from './format-owner-file.ts';

test('it writes the header and one row per note, with a dash for no item', () => {
  const text = formatOwnerFile([
    { id: 'o-1', text: 'Ask first', said: '2026-03-10T11:00:00Z', on: null },
    { id: 'o-2', text: 'Use the recorded readings', said: '2026-03-10T11:05:00Z', on: 't-timer' },
  ]);

  expect(text).toBe(
    'id\ttext\tsaid\ton\no-1\tAsk first\t2026-03-10T11:00:00Z\t-\no-2\tUse the recorded readings\t2026-03-10T11:05:00Z\tt-timer\n',
  );
});

test('it writes only the header for no notes', () => {
  expect(formatOwnerFile([])).toBe('id\ttext\tsaid\ton\n');
});
