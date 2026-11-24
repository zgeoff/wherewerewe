import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';
import { toPlaceholder } from './to-placeholder.ts';

test('it adds all three flags in order to a command that typed none', () => {
  const args = buildParsedArgs(['grant']);

  expect(
    addGrantFlags(buildRunSpec(args), new Set(), ['may', 'not', 'never']).toArgv(),
  ).toStrictEqual([
    'grant',
    '--may',
    toPlaceholder('<what the owner allows, in their words>'),
    '--where',
    'chat',
    '--reading',
    toPlaceholder('<what they cover; what the owner kept back>'),
  ]);
});

test('it adds only the flags that the command did not type', () => {
  const args = buildParsedArgs(['grant', '--where', 'terminal']);

  expect(
    addGrantFlags(buildRunSpec(args), new Set(['where']), ['may', 'not', 'never']).toArgv(),
  ).toStrictEqual([
    'grant',
    '--where',
    'terminal',
    '--may',
    toPlaceholder('<what the owner allows, in their words>'),
    '--reading',
    toPlaceholder('<what they cover; what the owner kept back>'),
  ]);
});

test.each([{ flag: 'may' }, { flag: 'not' }, { flag: 'never' }])(
  'it adds no --may to a command that typed --$flag',
  (row) => {
    const args = buildParsedArgs(['grant', `--${row.flag}`, 'x']);

    expect(
      addGrantFlags(buildRunSpec(args), new Set([row.flag]), ['may', 'not', 'never']).toArgv(),
    ).toStrictEqual([
      'grant',
      `--${row.flag}`,
      'x',
      '--where',
      'chat',
      '--reading',
      toPlaceholder('<what they cover; what the owner kept back>'),
    ]);
  },
);

test('it adds --may to a command that typed only --not when --may alone counts', () => {
  const args = buildParsedArgs(['grant', '--not', 'x']);

  expect(addGrantFlags(buildRunSpec(args), new Set(['not']), ['may']).toArgv()).toStrictEqual([
    'grant',
    '--not',
    'x',
    '--may',
    toPlaceholder('<what the owner allows, in their words>'),
    '--where',
    'chat',
    '--reading',
    toPlaceholder('<what they cover; what the owner kept back>'),
  ]);
});
