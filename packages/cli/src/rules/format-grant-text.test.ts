import { expect, test } from 'bun:test';
import { formatGrantText } from './format-grant-text.ts';

test('it joins each group with bullets, then the scope', () => {
  expect(
    formatGrantText({
      may: ['water the beds', 'mow the lawn'],
      not: [],
      never: ['dig up the roses'],
      scope: 'in the east garden',
    }),
  ).toBe(
    'may: water the beds • mow the lawn · never: dig up the roses · scope: in the east garden',
  );
});

test('it leaves the scope out of a grant with none', () => {
  expect(formatGrantText({ may: ['water the beds'], not: ['prune'], never: [], scope: null })).toBe(
    'may: water the beds · not: prune',
  );
});
