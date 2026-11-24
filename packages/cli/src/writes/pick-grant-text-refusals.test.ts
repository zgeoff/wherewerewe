import { expect, test } from 'bun:test';
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

test('it gives only the bullet refusal for 13 bullets', () => {
  const ctx = setupTest();
  const bullets = Array.from({ length: 13 }, () => ['--never', 'n']).flat();

  expect(ctx.pick(bullets)).toStrictEqual([{ kind: 'grant-too-many-bullets', count: 13 }]);
});

test('it gives only the words refusal for 701 characters', () => {
  const ctx = setupTest();

  expect(ctx.pick(['--may', buildSpacedText(701)])).toStrictEqual([
    { kind: 'grant-words-too-long', length: 701 },
  ]);
});

test('it gives a bullet that holds a bullet mark only the mark refusal', () => {
  const ctx = setupTest();

  expect(ctx.pick(['--not', 'dig • spray'])).toStrictEqual([{ kind: 'text-has-mark' }]);
});
