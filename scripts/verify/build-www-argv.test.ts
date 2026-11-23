import { expect, test } from 'bun:test';
import { buildWWWArgv } from './build-www-argv.ts';

test('it runs www with HOME and XDG_STATE_HOME inside the run folder', () => {
  const argv = buildWWWArgv('/runs/r-1', ['help']);

  expect(argv.slice(0, 4)).toStrictEqual([
    'env',
    'HOME=/runs/r-1/home',
    'XDG_STATE_HOME=/runs/r-1/state',
    'bun',
  ]);

  expect(argv.at(-2)?.endsWith('packages/cli/src/cli.ts')).toBe(true);
  expect(argv.at(-1)).toBe('help');
});
