import { expect, test } from 'bun:test';
import { buildFilledRunArgv } from './build-filled-run-argv.ts';

test('it replaces each placeholder from the fills', () => {
  const argv = buildFilledRunArgv('Run: www task <new id> "<claim>" --pr <owner>/<repo>#<number>', {
    '<new id>': 't-fresh',
    '<claim>': 'Write the parser',
    '<owner>/<repo>#<number>': 'acme/tool#4',
  });

  expect(argv).toStrictEqual(['task', 't-fresh', 'Write the parser', '--pr', 'acme/tool#4']);
});

test('it throws when a placeholder has no fill', () => {
  expect(() => buildFilledRunArgv('Run: www task <new id> "<claim>"', { '<claim>': 'x' })).toThrow(
    'no fill for the placeholder <new id>',
  );
});

test('it leaves a line with no placeholder as it is', () => {
  expect(buildFilledRunArgv('Run: www done t-a --evidence "commit 4c1d2e0"', {})).toStrictEqual([
    'done',
    't-a',
    '--evidence',
    'commit 4c1d2e0',
  ]);
});
