import { expect, mock, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import { pickGrantTextRefusals } from './pick-grant-text-refusals.ts';

function setupTest() {
  return {
    pick: (argv: readonly string[]) =>
      pickGrantTextRefusals(
        buildParsedArgs(['grant', ...argv, '--where', 'chat', '--reading', 'r']),
      ).map((reason) => {
        if (reason.kind === 'grant-too-many-lines') {
          return { kind: reason.kind, lines: reason.lines };
        }

        if (reason.kind === 'grant-too-many-bullets') {
          return { kind: reason.kind, count: reason.count };
        }

        if (reason.kind === 'grant-words-too-long') {
          return { kind: reason.kind, length: reason.length };
        }

        return { kind: reason.kind };
      }),
  };
}

test('it gives no refusal for a bullet of 162 characters', () => {
  const ctx = setupTest();

  expect(ctx.pick(['--may', buildSpacedText(162)])).toStrictEqual([]);
});

test('it gives grant-too-many-lines with 20 lines for a bullet of 649 characters in words of 74 and 11 of one', () => {
  const ctx = setupTest();
  const ones = Array.from({ length: 11 }, () => ['--may', 'o']).flat();

  expect(ctx.pick(['--may', buildSpacedText(649, 74), ...ones])).toStrictEqual([
    { kind: 'grant-too-many-lines', lines: 20 },
  ]);
});

test('it gives only the bullet refusal for 13 bullets that also take 21 lines', () => {
  const ctx = setupTest();
  const ones = Array.from({ length: 12 }, () => ['--may', 'o']).flat();

  expect(ctx.pick(['--may', buildSpacedText(649, 74), ...ones])).toStrictEqual([
    { kind: 'grant-too-many-bullets', count: 13 },
  ]);
});

test('it gives only the words refusal for 701 characters that also take 21 lines', () => {
  const ctx = setupTest();
  const ones = Array.from({ length: 11 }, () => ['--may', 'o']).flat();

  expect(ctx.pick(['--may', buildSpacedText(690, 74), ...ones])).toStrictEqual([
    { kind: 'grant-words-too-long', length: 701 },
  ]);
});

test('it gives the bullet refusal and the words refusal together for 13 bullets of 701 characters', () => {
  const ctx = setupTest();
  const ones = Array.from({ length: 12 }, () => ['--may', 'o']).flat();

  expect(ctx.pick(['--may', buildSpacedText(689, 74), ...ones])).toStrictEqual([
    { kind: 'grant-too-many-bullets', count: 13 },
    { kind: 'grant-words-too-long', length: 701 },
  ]);
});

test('it gives a bullet that holds a bullet mark only the mark refusal', () => {
  const ctx = setupTest();

  expect(ctx.pick(['--not', 'dig • spray'])).toStrictEqual([{ kind: 'text-has-mark' }]);
});

test.each([
  { title: '13 bullets', argv: Array.from({ length: 13 }, () => ['--may', 'o']).flat() },
  { title: 'a bullet of 120,000 characters', argv: ['--may', buildSpacedText(120_000)] },
])('it counts no lines before it refuses $title', (row) => {
  const countLines = mock(() => 0);

  pickGrantTextRefusals(
    buildParsedArgs(['grant', ...row.argv, '--where', 'chat', '--reading', 'r']),
    countLines,
  );

  expect(countLines).not.toHaveBeenCalled();
});

test('it counts the lines of a grant in its bullet and word limits', () => {
  const countLines = mock(() => 20);

  const kinds = pickGrantTextRefusals(
    buildParsedArgs(['grant', '--may', buildSpacedText(162), '--where', 'chat', '--reading', 'r']),
    countLines,
  ).map((reason) => reason.kind);

  expect({ calls: countLines.mock.calls.length, kinds }).toStrictEqual({
    calls: 1,
    kinds: ['grant-too-many-lines'],
  });
});
