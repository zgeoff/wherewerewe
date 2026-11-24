import { expect, test } from 'bun:test';
import { wrapBlock } from './wrap-block.ts';

test('it keeps a text that fits in 100 characters on one line', () => {
  expect(wrapBlock('Keep the kiln off', '    ', '    ')).toStrictEqual(['    Keep the kiln off']);
});

test('it wraps a 400-character note of words that end at column 85 to 5 lines', () => {
  const note = [...Array.from({ length: 4 }, () => 'w'.repeat(81)), 'v'.repeat(72)].join(' ');
  const lines = wrapBlock(note, '    ', '    ');

  expect(note).toHaveLength(400);
  expect(lines.map((line) => line.length)).toStrictEqual([85, 85, 85, 85, 76]);
});

test('it wraps a 200-character goal of 49-character words to 3 lines', () => {
  const word = 'a'.repeat(49);
  const goal = [word, word, word, word].join(' ').slice(0, 200);

  expect(wrapBlock(goal, 'GOAL  ', ' '.repeat(6))).toHaveLength(3);
});

test('it breaks at the last space that leaves the line 85 to 100 characters long', () => {
  const text = `${'a'.repeat(90)} ${'b'.repeat(5)} ${'c'.repeat(20)}`;

  expect(wrapBlock(text, '', '  ')).toStrictEqual([
    `${'a'.repeat(90)} ${'b'.repeat(5)}`,
    `  ${'c'.repeat(20)}`,
  ]);
});

test('it cuts at 100 when no space leaves the line 85 to 100 characters long', () => {
  const text = `${'a'.repeat(120)}`;

  expect(wrapBlock(text, '', '')).toStrictEqual(['a'.repeat(100), 'a'.repeat(20)]);
});

test('it counts code points and not UTF-16 units', () => {
  const text = `${'🌊'.repeat(100)}${'🌊'.repeat(10)}`;

  expect(wrapBlock(text, '', '')).toStrictEqual(['🌊'.repeat(100), '🌊'.repeat(10)]);
});
