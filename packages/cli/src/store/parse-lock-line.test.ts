import { expect, test } from 'bun:test';
import { parseLockLine } from './parse-lock-line.ts';

test.each([
  [
    'a pid and an ISO ts',
    'pid=42 ts=2026-03-10T11:43:00.000Z\n',
    { pid: 42, tsMs: Date.parse('2026-03-10T11:43:00.000Z') },
  ],
  ['no newline at the end', 'pid=42 ts=2026-03-10T11:43:00.000Z', null],
  ['a ts that is no time', 'pid=42 ts=soon\n', null],
  ['pid 0', 'pid=0 ts=2026-03-10T11:43:00.000Z\n', null],
  ['half a write', 'pid=4', null],
  ['nothing', '', null],
])('it reads %s', (_title, content, expected) => {
  expect(parseLockLine(content)).toStrictEqual(expected);
});
