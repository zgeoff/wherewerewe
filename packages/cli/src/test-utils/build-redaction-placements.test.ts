import { expect, test } from 'bun:test';
import { buildRedactionPlacements } from './build-redaction-placements.ts';

test('it builds each placement around the sample, and the wrap placement crosses column 90 to 100', () => {
  const values = buildRedactionPlacements().map((placement) => placement.build('SAMPLE'));

  expect({
    holdsSample: values.every((value) => value.includes('SAMPLE')),
    wrapStart: values[1]?.indexOf('SAMPLE'),
  }).toStrictEqual({ holdsSample: true, wrapStart: 92 });
});
