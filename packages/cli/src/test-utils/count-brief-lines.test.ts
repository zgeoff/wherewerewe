import { expect, test } from 'bun:test';
import { countBriefLines } from './count-brief-lines.ts';

test('it counts the lines that end with a newline', () => {
  expect(countBriefLines('a\nb\nc\n')).toStrictEqual(3);
});
