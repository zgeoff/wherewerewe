import { expect, test } from 'bun:test';
import { buildSampleRunArgv } from './build-sample-run-argv.ts';

test('it fills each placeholder with a short word and leaves the other words as they are', () => {
  expect(
    buildSampleRunArgv(
      'Run: www grant --may "<what the owner allows, in their words>" --where chat',
    ),
  ).toStrictEqual(['grant', '--may', 'x', '--where', 'chat']);
});

test('it fills an id placeholder with a new id and a who placeholder with agent', () => {
  expect(buildSampleRunArgv('Run: www decide <new id> --who <owner or agent>')).toStrictEqual([
    'decide',
    'n-c',
    '--who',
    'agent',
  ]);
});
