import { expect, test } from 'bun:test';
import { buildOkArgv } from './build-ok-argv.ts';

test('it ends the argv with the flags it is given', () => {
  expect(buildOkArgv('--once', '--note', 'n').slice(-3)).toStrictEqual(['--once', '--note', 'n']);
});

test('it holds every part of an approval when it is given no flag', () => {
  expect(buildOkArgv()).toStrictEqual([
    'ok',
    'ok-merge',
    '--quote',
    'merge the alert PRs yourself',
    '--who',
    'owner',
    '--where',
    'terminal',
    '--scope',
    'bosun-api',
  ]);
});
