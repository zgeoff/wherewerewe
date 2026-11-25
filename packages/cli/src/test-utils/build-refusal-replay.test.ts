import { expect, test } from 'bun:test';
import { toPlaceholder } from '../refusals/to-placeholder.ts';
import { buildRefusalReplay } from './build-refusal-replay.ts';

function setupTest() {
  return { buildRefusalReplay };
}

test('it gives the filled lines of each scope and the words each should pass', () => {
  const ctx = setupTest();

  const replay = ctx.buildRefusalReplay(
    {
      exitCode: 2,
      lines: ['www: refused: x.'],
      runs: [
        { www: ['drop', toPlaceholder('<id>'), '--why', toPlaceholder('<reason>')] },
        { usage: 'now <id> "<next step>" [--note "<detail>"]' },
      ],
    },
    [
      { sessionFlag: null, writes: false },
      { sessionFlag: 'a$b', writes: true },
    ],
  );

  expect(replay).toStrictEqual({
    script: [
      'www drop zz-a --why "<reason>"',
      'www now zz-a "<next step>" ',
      String.raw`www --session "a\$b" drop zz-a --why "<reason>"`,
      String.raw`www --session "a\$b" now zz-a "<next step>"   # nothing was written`,
    ].join('\n'),
    expected: [
      ['www', 'drop', 'zz-a', '--why', '<reason>'],
      ['www', 'now', 'zz-a', '<next step>'],
      ['www', '--session', 'a$b', 'drop', 'zz-a', '--why', '<reason>'],
      ['www', '--session', 'a$b', 'now', 'zz-a', '<next step>'],
    ],
    comments: [false, false, false, true],
    expectedComments: [false, false, false, true],
  });
});
