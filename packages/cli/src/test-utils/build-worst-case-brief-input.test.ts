import { expect, test } from 'bun:test';
import { buildWorstCaseBriefInput } from './build-worst-case-brief-input.ts';

test('it builds the worst case with the tasks and the host the test names', () => {
  const input = buildWorstCaseBriefInput({ host: 'claude', taskCount: 30 });

  expect({
    host: input.host,
    tasks: input.items.filter((item) => item.kind === 'task'),
    goal: input.session.goal,
  }).toStrictEqual({
    host: 'claude',
    tasks: expect.toBeArrayOfSize(30),
    goal: expect.toBeString(),
  });
});

test.each([
  { grant: 'wide-bullets', bullets: 12, scope: 40 },
  { grant: 'long-bullet', bullets: 12, scope: 40 },
  { grant: 'long-bullet-no-scope', bullets: 12, scope: null },
] as const)('it builds the $grant grant of 12 bullets and 700 characters', (row) => {
  const grant = buildWorstCaseBriefInput({ host: 'codex', taskCount: 6, grant: row.grant }).session
    .grant;

  expect({
    bullets: (grant?.may.length ?? 0) + (grant?.not.length ?? 0) + (grant?.never.length ?? 0),
    scope: grant?.scope === null ? null : grant?.scope.length,
    words: [
      ...[
        ...(grant?.may ?? []),
        ...(grant?.not ?? []),
        ...(grant?.never ?? []),
        grant?.scope ?? '',
      ].join(''),
    ].length,
  }).toStrictEqual({ bullets: row.bullets, scope: row.scope, words: 700 });
});
