import { expect, test } from 'bun:test';
import { buildMockBriefInput } from '../test-utils/build-mock-brief-input.ts';
import { buildMockSession } from '../test-utils/build-mock-session.ts';
import { buildSpacedText } from '../test-utils/build-spaced-text.ts';
import type { Grant } from '../types.ts';
import { renderBrief } from './render-brief.ts';
import { renderGrantLines } from './render-grant-lines.ts';

function setupTest() {
  return { nowMs: Date.parse('2026-03-10T11:43:00Z') };
}

test('it renders the heading with where, age and scope, then the bullets under each label, then the reading', () => {
  const ctx = setupTest();

  const grant: Grant = {
    may: ['merge the alert PRs once CI is green', 'deploy either app to staging'],
    not: ['the prod database'],
    never: ['the prod push certificate'],
    scope: 'in bosun-api and bosun-app',
    reading: 'covers merges on green CI and staging deploys; kept back: the prod database',
    where: 'chat',
    set: '2026-03-03T09:00:00Z',
  };

  expect(renderGrantLines(grant, ctx.nowMs)).toStrictEqual([
    'GRANT  from the owner in chat, 7d ago · in bosun-api and bosun-app',
    '  may    • merge the alert PRs once CI is green',
    '         • deploy either app to staging',
    '  not    • the prod database',
    '  never  • the prod push certificate',
    '  reading: covers merges on green CI and staging deploys; kept back: the prod database',
  ]);
});

test('it leaves the scope out of the heading when the grant has none', () => {
  const ctx = setupTest();

  const grant: Grant = {
    may: ['water the beds'],
    not: [],
    never: [],
    scope: null,
    reading: 'covers watering',
    where: 'chat',
    set: '2026-03-10T10:43:00Z',
  };

  expect(renderGrantLines(grant, ctx.nowMs).slice(0, 2)).toStrictEqual([
    'GRANT  from the owner in chat, 1h ago',
    '  may    • water the beds',
  ]);
});

test('it renders the worst-case grant in 23 lines of at most 100 characters', () => {
  const ctx = setupTest();

  const lines = renderGrantLines(
    {
      may: Array.from({ length: 7 }, () => 'm'.repeat(90)),
      not: Array.from({ length: 5 }, () => 'x'.repeat(6)),
      never: [],
      scope: 's'.repeat(40),
      reading: buildSpacedText(200),
      where: 'w'.repeat(16),
      set: '2026-03-03T09:00:00Z',
    },
    ctx.nowMs,
  );

  expect({
    count: lines.length,
    widest: Math.max(...lines.map((line) => line.split(/(?:)/u).length)),
  }).toStrictEqual({ count: 23, widest: 100 });
});

test('it gives the lines the brief prints right after the goal', () => {
  const ctx = setupTest();

  const grant: Grant = {
    may: ['water the beds'],
    not: ['prune the roses'],
    never: [],
    scope: null,
    reading: 'covers watering',
    where: 'chat',
    set: '2026-03-10T10:43:00Z',
  };

  const brief = renderBrief(
    buildMockBriefInput({ session: buildMockSession({ goal: 'Ship it', grant }) }),
  );

  expect(brief.split('\n').slice(2, 2 + renderGrantLines(grant, ctx.nowMs).length)).toStrictEqual(
    renderGrantLines(grant, ctx.nowMs),
  );
});
