import { expect, test } from 'bun:test';
import { formatGateFile } from './format-gate-file.ts';
import { parseGateFile } from './parse-gate-file.ts';

function setupTest() {
  return { parseGateFile, formatGateFile };
}

test('it reads the line that it writes', () => {
  const ctx = setupTest();
  const file = { state: 'reading', session: 'tide-alerts', reads: 2, spare: 0 } as const;

  expect(ctx.parseGateFile(ctx.formatGateFile(file))).toStrictEqual(file);
});

test.each([
  'state=wiped session=tide-alerts reads=0',
  'state=asleep session=tide-alerts reads=0 spare=1',
  'state=wiped session=tide-alerts reads=x spare=1',
  'state=wiped session=tide-alerts reads=0 spare=2',
  '',
])('it returns null for the line %j', (text) => {
  const ctx = setupTest();

  expect(ctx.parseGateFile(text)).toBeNull();
});
