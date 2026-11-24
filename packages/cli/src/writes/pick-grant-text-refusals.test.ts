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

test.each([
  { title: 'a next line', separator: '\u0085' },
  { title: 'a line feed', separator: '\n' },
])('it gives credential for a credential that $title splits in a bullet', (row) => {
  const ctx = setupTest();
  const split = ['ops', '_', 'a'.repeat(10), row.separator, 'b'.repeat(10)].join('');

  expect(ctx.pick(['--not', `keep ${split} out of the beds`])).toStrictEqual([
    { kind: 'credential' },
  ]);
});

test('it gives credential for a credential that a line feed splits in the scope', () => {
  const ctx = setupTest();
  const split = ['ops', '_', 'a'.repeat(10), '\n', 'b'.repeat(10)].join('');

  expect(ctx.pick(['--not', 'replant the beds', '--scope', `in ${split}`])).toStrictEqual([
    { kind: 'credential' },
  ]);
});

test.each([
  {
    title: 'a bullet that also holds the bullet mark',
    argv: ['--not', `${['ops', '_', 'a'.repeat(10), '\n', 'b'.repeat(10)].join('')} •`],
  },
  {
    title: 'a continuation line indented with spaces',
    argv: ['--not', ['ops', '_', 'a'.repeat(10), ' \n  ', 'b'.repeat(10)].join('')],
  },
  {
    title: 'a scope that a later --scope replaces',
    argv: [
      '--not',
      'tend the beds',
      '--scope',
      ['ops', '_', 'a'.repeat(10), '\n', 'b'.repeat(10)].join(''),
      '--scope',
      'garden',
    ],
  },
])('it gives credential alone for a split credential in $title', (row) => {
  const ctx = setupTest();

  expect(ctx.pick(row.argv)).toStrictEqual([{ kind: 'credential' }]);
});

test('it gives one credential for two typed scopes that each hold a split credential', () => {
  const ctx = setupTest();
  const split = ['ops', '_', 'a'.repeat(10), '\n', 'b'.repeat(10)].join('');

  expect(ctx.pick(['--not', 'tend', '--scope', split, '--scope', split])).toStrictEqual([
    { kind: 'credential' },
  ]);
});
