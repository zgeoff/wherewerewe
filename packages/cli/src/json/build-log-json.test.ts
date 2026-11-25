import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { buildMockJournalRow } from '../test-utils/build-mock-journal-row.ts';
import { jsonSchemas } from '../test-utils/json-schemas.ts';
import { runJsonCommand } from '../test-utils/run-json-command.ts';
import { seedJsonShapesStore } from '../test-utils/seed-json-shapes-store.ts';
import { buildLogJSON } from './build-log-json.ts';
import { jsonVersion } from './json-version.ts';

function setupTest() {
  return {
    root: createTempDir('build-log-json').path,
    buildLogJSON,
    seed: seedJsonShapesStore,
    run: runJsonCommand,
  };
}

test('it holds no row for a journal with none', () => {
  const ctx = setupTest();

  expect(ctx.buildLogJSON([])).toStrictEqual({ ...jsonVersion, rows: [] });
});

test('it holds every row whole, oldest first', () => {
  const ctx = setupTest();
  const newer = buildMockJournalRow({ ts: '2026-03-10T10:00:00Z', op: 'done', id: 't-a' });

  const older = buildMockJournalRow({
    ts: '2026-03-09T10:00:00Z',
    op: 'task',
    id: 't-a',
    text: 'x',
  });

  expect(ctx.buildLogJSON([newer, older])).toStrictEqual({ ...jsonVersion, rows: [older, newer] });
});

test.each([['day 9' as const], ['worst case' as const]])(
  'it prints www log --json as its type for the %s store',
  async (store) => {
    const ctx = setupTest();

    const env = await ctx.seed(ctx.root, store);
    const printed = await ctx.run(env, ['log']);

    const result = jsonSchemas.log.safeParse(printed.value);

    expect({
      exitCode: printed.exitCode,
      lines: printed.lines,
      issues: result.error?.issues,
    }).toStrictEqual({
      exitCode: 0,
      lines: 1,
      issues: undefined,
    });
  },
);
