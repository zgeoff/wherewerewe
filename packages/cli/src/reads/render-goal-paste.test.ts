import { expect, test } from 'bun:test';
import { createTempDir } from '@zgeoff/testing/fs';
import { readStore } from '../store/read-store.ts';
import { buildCredentialSamples } from '../test-utils/build-credential-samples.ts';
import { buildMockGrant } from '../test-utils/build-mock-grant.ts';
import { readDesignBlock } from '../test-utils/read-design-block.ts';
import { seedDayNineStore } from '../test-utils/seed-day-nine-store.ts';
import type { Grant } from '../types.ts';
import { renderGoalPaste } from './render-goal-paste.ts';

function setupTest() {
  return {
    renderGoalPaste,
    readExample: () =>
      readDesignBlock('lists-and-json.md', '### www goal --paste', 'text')
        .split('\n')
        .slice(1)
        .join('\n'),
    readDayNineGrant: async (): Promise<Grant> => {
      const root = createTempDir('render-goal-paste').path;

      const store = await seedDayNineStore(root);
      const read = await readStore(`${store.stateRoot}/tide-alerts`);

      if (read.kind !== 'store' || read.store.session.grant === null) {
        throw new Error('the day 9 store holds a grant');
      }

      return read.store.session.grant;
    },
  };
}

test('it prints the example of lists-and-json.md from the day 9 grant', async () => {
  const ctx = setupTest();

  const grant = await ctx.readDayNineGrant();

  expect(ctx.renderGoalPaste(grant, 'tide-alerts')).toBe(ctx.readExample());
});

test('it prints no scope line for a grant with no scope', () => {
  const ctx = setupTest();
  const text = ctx.renderGoalPaste(buildMockGrant({ may: ['water the beds'] }), 'garden-beds');

  expect(text).toBe(
    '  may    • water the beds\nRun www --session garden-beds and deliver all the work in it.\n',
  );
});

test('it puts the never bullets of a grant that holds only those on one line', () => {
  const ctx = setupTest();

  const text = ctx.renderGoalPaste(
    buildMockGrant({
      may: [],
      not: [],
      never: ['dig up the roses', 'spray after dusk'],
      scope: 'in the east bed',
    }),
    'garden-beds',
  );

  expect(text).toBe(
    '  never  • dig up the roses  • spray after dusk\n  scope  in the east bed\nRun www --session garden-beds and deliver all the work in it.\n',
  );
});

test.each(
  buildCredentialSamples().flatMap((entry) => [
    {
      name: entry.name,
      sample: entry.sample,
      place: 'at its start',
      before: '',
      after: ' then water',
    },
    {
      name: entry.name,
      sample: entry.sample,
      place: 'across the wrap column',
      before: `${'w'.repeat(95)} `,
      after: ' then water',
    },
    {
      name: entry.name,
      sample: entry.sample,
      place: 'at its end',
      before: 'water the beds ',
      after: '',
    },
  ]),
)('it prints the redacted bullet where a $name credential sits $place', (row) => {
  const ctx = setupTest();

  const text = ctx.renderGoalPaste(
    buildMockGrant({ may: [`${row.before}${row.sample}${row.after}`] }),
    'garden-beds',
  );

  expect(text).toInclude('<where the secret lives>');
  expect(text).not.toInclude(row.sample.slice(4));
});
