import { expect, test } from 'bun:test';
import { buildParsedArgs } from '../test-utils/build-parsed-args.ts';
import { addGrantFlags } from './add-grant-flags.ts';
import { buildRunSpec } from './build-run-spec.ts';

test('it adds all three flags in order to a command that typed none', () => {
  const args = buildParsedArgs(['grant']);

  expect(addGrantFlags(buildRunSpec(args), new Set()).toArgv()).toStrictEqual([
    'grant',
    '--may',
    '<what the owner allows, in their words>',
    '--where',
    'chat',
    '--reading',
    '<what they cover; what the owner kept back>',
  ]);
});

test('it adds only the flags that the command did not type', () => {
  const args = buildParsedArgs(['grant', '--where', 'terminal']);

  expect(addGrantFlags(buildRunSpec(args), new Set(['where'])).toArgv()).toStrictEqual([
    'grant',
    '--where',
    'terminal',
    '--may',
    '<what the owner allows, in their words>',
    '--reading',
    '<what they cover; what the owner kept back>',
  ]);
});
