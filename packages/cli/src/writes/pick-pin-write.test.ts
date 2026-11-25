import { expect, test } from 'bun:test';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import { pickPinWrite } from './pick-pin-write.ts';

function setupTest() {
  return {
    pick: (argv: readonly string[]) =>
      pickPinWrite({
        store: buildMockStore({}),
        journal: buildMockJournalIndex({}),
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
  };
}

test('it writes the sentence as the pin, and touches the time of the last write', () => {
  const ctx = setupTest();

  const picked = getPickedWrite(
    ctx.pick(['pin', 'Small and plain: a sailor reads an alert at a glance']),
    7,
  );

  expect({
    pin: picked.change.pin,
    lastWrite: picked.change.session?.lastWrite,
    journal: picked.change.journal,
    reply: picked.reply,
  }).toStrictEqual({
    pin: 'Small and plain: a sailor reads an alert at a glance',
    lastWrite: '2026-03-10T11:43:00Z',
    journal: [],
    reply: 'pin set. Brief: 7 of 8000 tokens.',
  });
});

test('it clears the pin with --clear', () => {
  const ctx = setupTest();
  const picked = getPickedWrite(ctx.pick(['pin', '--clear']), 7);

  expect({ pin: picked.change.pin, reply: picked.reply }).toStrictEqual({
    pin: '',
    reply: 'pin cleared. Brief: 7 of 8000 tokens.',
  });
});

test.each([
  {
    title: 'a pin over 200 characters',
    sentence: 'x'.repeat(201),
    lines: [
      'www: refused: the pin is 201 characters, and the limit is 200. Write what is true now; the story belongs in a PR or a commit.',
    ],
    placeholder: '<pin of at most 200 characters>',
  },
  {
    title: 'a pin of two lines',
    sentence: 'Small and plain.\nRead at a glance.',
    lines: ['www: refused: the text must be one line, with no tab or newline.'],
    placeholder: '<one line>',
  },
])('it refuses $title with the Run line that fixes it', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(['pin', row.sentence]);

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    row.lines,
    [{ www: ['pin', { placeholder: row.placeholder }] }],
  ]);
});
