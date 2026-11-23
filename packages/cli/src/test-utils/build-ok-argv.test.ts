import { expect, test } from 'bun:test';
import { buildOkArgv } from './build-ok-argv.ts';

test.each(['--once', '--standing'] as const)('it ends the argv with %s', (use) => {
  const argv = buildOkArgv(use);

  expect(argv.at(-1)).toBe(use);
});
