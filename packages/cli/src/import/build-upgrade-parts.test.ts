import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { buildUpgradeParts } from './build-upgrade-parts.ts';

function setupTest() {
  return {
    build: (argv: readonly string[]) =>
      buildUpgradeParts([], buildParsedArgs(['import', 'garden-beds', ...argv]), {
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        byOwner: false,
      }),
  };
}

test('it builds a grant and its journal row from --not alone', () => {
  const ctx = setupTest();

  const parts = ctx.build([
    '--not',
    'replant the north beds before the soil report is in',
    '--where',
    'chat',
    '--reading',
    'covers nothing yet',
  ]);

  expect({ grant: parts.grant, journal: parts.journalRows }).toStrictEqual({
    grant: {
      may: [],
      not: ['replant the north beds before the soil report is in'],
      never: [],
      scope: null,
      reading: 'covers nothing yet',
      where: 'chat',
      set: '2026-03-10T11:43:00Z',
    },
    journal: [
      {
        ts: '2026-03-10T11:43:00Z',
        op: 'grant',
        id: 'grant',
        by: 'agent',
        text: 'not: replant the north beds before the soil report is in',
        why: 'covers nothing yet',
        extra: 'where=chat',
      },
    ],
  });
});

test('it builds a grant from --never alone', () => {
  const ctx = setupTest();
  const parts = ctx.build(['--never', 'dig up the roses', '--where', 'chat', '--reading', 'r']);

  expect(parts.grant?.never).toStrictEqual(['dig up the roses']);
});

test('it builds no grant and no grant row when no bullet flag is given', () => {
  const ctx = setupTest();
  const parts = ctx.build([]);

  expect({ grant: parts.grant, journal: parts.journalRows }).toStrictEqual({
    grant: null,
    journal: [],
  });
});
