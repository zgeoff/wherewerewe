import { expect, test } from 'bun:test';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildMockIDs } from '../test-utils/build-mock-ids.ts';
import { buildMockJournalIndex, buildMockStore } from '../test-utils/build-mock-store.ts';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { getPickedWrite } from '../test-utils/get-picked-write.ts';
import type { PromiseRow, Store } from '../types.ts';
import { pickPromiseWrite } from './pick-promise-write.ts';

function setupTest() {
  return {
    argv: [
      'promise',
      'due-cost',
      'Cost table for the alert fan-out',
      '--to',
      'owner',
      '--by',
      'day 10, before review',
    ],
    pick: (argv: readonly string[], store: Partial<Store> = {}) =>
      pickPromiseWrite({
        store: buildMockStore(store),
        journal: buildMockJournalIndex({}),
        args: buildParsedArgs(argv),
        cwd: '/work',
        nowMs: Date.parse('2026-03-10T11:43:00Z'),
        probed: null,
      }),
    promise: (id: string, written = '2026-03-04T09:00:00Z'): PromiseRow => ({
      id,
      what: 'Old',
      to: 'owner',
      byWhen: 'Friday',
      written,
      by: 'agent',
    }),
  };
}

test('it writes one row of promises.tsv and one journal row with to and by in its extra', () => {
  const ctx = setupTest();

  expect(getPickedWrite(ctx.pick(ctx.argv), 7)).toStrictEqual({
    change: {
      promises: [
        {
          id: 'due-cost',
          what: 'Cost table for the alert fan-out',
          to: 'owner',
          byWhen: 'day 10, before review',
          written: '2026-03-10T11:43:00Z',
          by: 'agent',
        },
      ],
      journal: [
        {
          ts: '2026-03-10T11:43:00Z',
          op: 'promise',
          id: 'due-cost',
          by: 'agent',
          text: 'Cost table for the alert fan-out',
          why: null,
          extra: 'to=owner;by=day 10, before review',
        },
      ],
    },
    reply: 'due-cost  promise to owner, by day 10, before review. Brief: 7 of 8000 tokens.',
  });
});

test.each([
  {
    title: 'no --to and no --by',
    argv: ['promise', 'due-cost', 'Cost table'],
    lines: ['www: refused: a promise names who gets it and when.'],
    run: [
      'promise',
      'due-cost',
      'Cost table',
      '--to',
      { placeholder: '<who>' },
      '--by',
      { placeholder: '<when>' },
    ],
  },
  {
    title: 'a --by with a semicolon',
    argv: ['promise', 'due-cost', 'Cost table', '--to', 'owner', '--by', 'Fri; Mon'],
    lines: ['www: refused: --by cannot hold ; or =, which the journal keeps apart.'],
    run: [
      'promise',
      'due-cost',
      'Cost table',
      '--to',
      'owner',
      '--by',
      { placeholder: '<when, with no ; or =>' },
    ],
  },
  {
    title: 'a --to over 16 characters',
    argv: ['promise', 'due-cost', 'Cost table', '--to', 'x'.repeat(17), '--by', 'Friday'],
    lines: [
      'www: refused: the --to is 17 characters, and the limit is 16. Write what is true now; the story belongs in a PR or a commit.',
    ],
    run: [
      'promise',
      'due-cost',
      'Cost table',
      '--to',
      { placeholder: '<--to of at most 16 characters>' },
      '--by',
      'Friday',
    ],
  },
])('it refuses $title', (row) => {
  const ctx = setupTest();
  const picked = ctx.pick(row.argv);

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    row.lines,
    [{ www: row.run }],
  ]);
});

test('it refuses a 6th promise with a done Run line for the oldest by time, not the first row', () => {
  const ctx = setupTest();

  const promises = buildMockIDs('prom', 5).map((id, at) =>
    ctx.promise(id, `2026-03-0${String(9 - at)}T09:00:00Z`),
  );

  const picked = ctx.pick(ctx.argv, { promises });

  expect(picked.kind === 'refused' && [picked.refusal.lines, picked.refusal.runs]).toStrictEqual([
    [
      'www: refused: the session holds 5 of 5 promises. Close one, or replace one with www promise.',
    ],
    [
      {
        www: ['done', 'prom05xxxxxxxxxx', '--evidence', { placeholder: '<what you delivered>' }],
      },
    ],
  ]);
});

test.each(
  (['to', 'by'] as const).flatMap((flag) =>
    buildCredentialSamples().map((entry) => [flag, entry.name, entry.sample] as const),
  ),
)(
  'it refuses a credential in --%s, a %s sample, as a credential before any limit',
  (flag, name, sample) => {
    const ctx = setupTest();

    const argv =
      flag === 'to'
        ? ['promise', 'due-cost', 'Cost table', `--to=${sample}`, '--by', 'Friday']
        : ['promise', 'due-cost', 'Cost table', '--to', 'owner', `--by=${sample}`];

    const picked = ctx.pick(argv);

    expect(picked.kind === 'refused' && picked.refusal.lines).toStrictEqual([
      `www: refused: the text looks like a credential (it matches the ${name} pattern). Write where the secret lives, never its value.`,
    ]);
  },
);
