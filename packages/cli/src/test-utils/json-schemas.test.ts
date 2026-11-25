import { expect, test } from 'bun:test';
import { jsonVersion } from '../json/json-version.ts';
import { jsonSchemas } from './json-schemas.ts';

function setupTest() {
  return {
    jsonSchemas,
    payloads: {
      brief: {
        ...jsonVersion,
        session: 'tide-alerts',
        day: 9,
        host: 'codex',
        limit: { bytes: 30_000, tokens: 10_000 },
        estimate: 1410,
        goal: 'Ship the alert screen',
        grant: { may: ['merge on green CI'], where: 'chat', reading: 'covers merges' },
        ownerNotes: [{ id: 'o-1', text: 'Ask first', said: '2026-03-10T09:40:12Z', on: null }],
        words: [],
        changed: [{ id: 't-a', was: 'OPEN pending', now: 'MERGED' }],
        focus: 't-a',
        next: 'run the tests',
        open: [],
        lessons: [],
        promises: [],
        decisions: [],
        prs: [],
      },
      show: { ...jsonVersion, subjects: [] },
      log: { ...jsonVersion, rows: [] },
      list: { ...jsonVersion, kind: 'decisions', rows: [] },
      recap: {
        ...jsonVersion,
        session: 'tide-alerts',
        day: 9,
        since: '2026-03-09T11:43:00Z',
        writes: 4,
        grant: null,
        promises: [],
        notes: [],
        otherOpen: ['t-a'],
        decidedSince: [],
        closedSince: [],
      },
    },
  };
}

test.each([
  { type: 'brief' as const },
  { type: 'show' as const },
  { type: 'log' as const },
  { type: 'list' as const },
  { type: 'recap' as const },
])('it accepts the valid $type payload', (row) => {
  const ctx = setupTest();
  const result = ctx.jsonSchemas[row.type].safeParse(ctx.payloads[row.type]);

  expect(result.success).toBe(true);
});

test.each([
  ...[
    'v',
    'session',
    'day',
    'host',
    'limit',
    'estimate',
    'goal',
    'grant',
    'ownerNotes',
    'words',
    'changed',
    'focus',
    'next',
    'open',
    'lessons',
    'promises',
    'decisions',
    'prs',
  ].map((field) => ({ type: 'brief' as const, field })),
  ...['v', 'subjects'].map((field) => ({ type: 'show' as const, field })),
  ...['v', 'rows'].map((field) => ({ type: 'log' as const, field })),
  ...['v', 'rows'].map((field) => ({ type: 'list' as const, field })),
  ...[
    'v',
    'session',
    'day',
    'since',
    'writes',
    'grant',
    'promises',
    'notes',
    'otherOpen',
    'decidedSince',
    'closedSince',
  ].map((field) => ({ type: 'recap' as const, field })),
])('it rejects $field removed from the $type payload', (row) => {
  const ctx = setupTest();

  const removed = Object.fromEntries(
    Object.entries(ctx.payloads[row.type]).filter(([key]) => key !== row.field),
  );

  const result = ctx.jsonSchemas[row.type].safeParse(removed);

  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: [row.field] }));
});

test.each([{ type: 'brief' as const }, { type: 'show' as const }, { type: 'log' as const }])(
  'it rejects a field the $type type lacks',
  (row) => {
    const ctx = setupTest();

    const result = ctx.jsonSchemas[row.type].safeParse({
      ...ctx.payloads[row.type],
      extra: 'a new field',
    });

    expect(result.success).toBe(false);
  },
);
