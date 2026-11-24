import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import type { Note } from '../types.ts';
import {
  buildChangedNotes,
  buildNoteJournalRows,
  pickNoClearRefusal,
  pickNoteChange,
  pickNoteTextRefusal,
} from './pick-note-change.ts';

test.each([
  ['no flag', ['set', 't-a', 'Claim'], { kind: 'keep' }],
  [
    'a note',
    ['set', 't-a', 'Claim', '--note', 'detail'],
    {
      kind: 'write',
      note: { id: 't-a', owed: false, written: '2026-03-10T11:43:00Z', note: 'detail' },
    },
  ],
  [
    'an owed note',
    ['set', 't-a', 'Claim', '--note', 'detail', '--owed'],
    {
      kind: 'write',
      note: { id: 't-a', owed: true, written: '2026-03-10T11:43:00Z', note: 'detail' },
    },
  ],
  ['--no-note', ['set', 't-a', '--no-note'], { kind: 'clear' }],
])('#pickNoteChange reads %s', (_title, argv, change) => {
  const actual: unknown = pickNoteChange(
    buildParsedArgs(argv),
    't-a',
    Date.parse('2026-03-10T11:43:00Z'),
  );

  expect(actual).toStrictEqual(change);
});

test.each([
  ['--owed with no --note', ['task', 't-a', 'Claim', '--owed'], 'owed-needs-note'],
  ['--note with --no-note', ['set', 't-a', '--note', 'x', '--no-note'], 'note-and-no-note'],
  ['an empty note', ['set', 't-a', '--note', ''], 'text-empty'],
  ['a lone dash', ['set', 't-a', '--note', '-'], 'text-empty'],
  ['a tab', ['set', 't-a', '--note', 'a\tb'], 'text-not-one-line'],
  ['a newline', ['set', 't-a', '--note', 'a\nb'], 'text-not-one-line'],
  ['a note of 401 characters', ['set', 't-a', '--note', 'n'.repeat(401)], 'text-too-long'],
  ['a credential', ['set', 't-a', '--note', `AKIA${'Q'.repeat(16)}`], 'credential'],
])('#pickNoteTextRefusal refuses %s', (_title, argv, kind) => {
  const reason = pickNoteTextRefusal(buildParsedArgs(argv));
  const actual: string | undefined = reason?.kind;

  expect(actual).toBe(kind);
});

test('#pickNoteTextRefusal checks --note with --no-note before the text of --note', () => {
  const reason = pickNoteTextRefusal(
    buildParsedArgs(['set', 't-a', '--note', 'a\tb', '--no-note', '--owed']),
  );

  expect(reason?.kind).toBe('note-and-no-note');
});

test('#pickNoteTextRefusal accepts a note of 400 characters', () => {
  const args = buildParsedArgs(['set', 't-a', '--note', 'n'.repeat(400)]);

  expect(pickNoteTextRefusal(args)).toBeNull();
});

test('#pickNoClearRefusal refuses --no-note on an item with no note and not otherwise', () => {
  const args = buildParsedArgs(['set', 't-a', '--no-note']);
  const first: Note = { id: 't-a', owed: false, written: '2026-03-10T10:00:00Z', note: 'first' };

  expect([
    pickNoClearRefusal(args, 't-a', undefined)?.kind,
    pickNoClearRefusal(args, 't-a', first),
  ]).toStrictEqual(['no-note-to-clear', null]);
});

test('#buildChangedNotes replaces a row in place, appends a new one last and removes a cleared one', () => {
  const first: Note = { id: 't-a', owed: false, written: '2026-03-10T10:00:00Z', note: 'first' };
  const second: Note = { id: 't-b', owed: true, written: '2026-03-10T10:05:00Z', note: 'second' };
  const replacement: Note = { ...first, note: 'changed' };
  const added: Note = { id: 't-c', owed: false, written: 'w', note: 'third' };

  expect({
    replaced: buildChangedNotes([first, second], 't-a', { kind: 'write', note: replacement }),
    appended: buildChangedNotes([first, second], 't-c', { kind: 'write', note: added }),
    removed: buildChangedNotes([first, second], 't-a', { kind: 'clear' }),
    kept: buildChangedNotes([first, second], 't-a', { kind: 'keep' }),
  }).toStrictEqual({
    replaced: [replacement, second],
    appended: [first, second, added],
    removed: [second],
    kept: undefined,
  });
});

test('#buildNoteJournalRows gives no row to keep, a row to a write and a cleared row to a clear', () => {
  const first: Note = { id: 't-a', owed: false, written: '2026-03-10T10:00:00Z', note: 'first' };
  const owed: Note = { id: 't-a', owed: true, written: '2026-03-10T10:05:00Z', note: 'second' };

  expect({
    keep: buildNoteJournalRows('t-a', { kind: 'keep' }, 'ts'),
    write: buildNoteJournalRows('t-a', { kind: 'write', note: first }, 'ts'),
    owed: buildNoteJournalRows('t-a', { kind: 'write', note: owed }, 'ts'),
    clear: buildNoteJournalRows('t-a', { kind: 'clear' }, 'ts'),
  }).toStrictEqual({
    keep: [],
    write: [
      { ts: 'ts', op: 'note', id: 't-a', by: 'agent', text: 'first', why: null, extra: null },
    ],
    owed: [
      { ts: 'ts', op: 'note', id: 't-a', by: 'agent', text: 'second', why: null, extra: 'owed=1' },
    ],
    clear: [
      { ts: 'ts', op: 'note', id: 't-a', by: 'agent', text: null, why: null, extra: 'cleared=1' },
    ],
  });
});
