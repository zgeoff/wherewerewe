import { carriageReturnProblem } from './constants.ts';

export function checkHeader(
  file: string,
  header: string | null,
  expected: string,
  words: string,
): string[] {
  if (header === null || header === expected) {
    return [];
  }

  return header === `${expected}\r`
    ? [`${file} line 1: ${carriageReturnProblem}`]
    : [`${file} line 1: the header is not ${words}.`];
}
