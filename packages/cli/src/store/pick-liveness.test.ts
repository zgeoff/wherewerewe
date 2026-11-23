import { expect, test } from 'bun:test';
import { pickLiveness } from './pick-liveness.ts';

test.each([
  ['a matching start', '41', { kind: 'running', start: '41' }, 'alive'],
  ['a gone pid', '41', { kind: 'gone' }, 'dead'],
  ['a gone pid and no start in the line', null, { kind: 'gone' }, 'dead'],
  ['a start that differs', '41', { kind: 'running', start: '97' }, 'unknown'],
  ['a start the system cannot show', '41', { kind: 'running', start: null }, 'unknown'],
  ['no start in the line', null, { kind: 'running', start: '41' }, 'unknown'],
  ['no start on either side', null, { kind: 'running', start: null }, 'unknown'],
] as const)('it reads a holder with %s as %s', (_, start, process, liveness) => {
  const line = { pid: 51_022, tsMs: Date.parse('2026-03-10T11:43:00.000Z'), start };

  expect(pickLiveness(line, process)).toBe(liveness);
});
