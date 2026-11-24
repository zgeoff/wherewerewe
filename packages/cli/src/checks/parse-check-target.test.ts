import { expect, test } from 'bun:test';
import { parseCheckTarget } from './parse-check-target.ts';

test.each([
  ['pr:bosunhq/bosun-api#77', { kind: 'pr', repo: 'bosunhq/bosun-api', number: '77' }],
  [
    'branch:/srv/work/kiln@dock-map',
    { kind: 'branch', repoPath: '/srv/work/kiln', name: 'dock-map' },
  ],
  [
    'branch:/srv/work/kiln@feature@v2',
    { kind: 'branch', repoPath: '/srv/work/kiln@feature', name: 'v2' },
  ],
  ['path:/srv/kiln-sim', { kind: 'path', path: '/srv/kiln-sim' }],
  ['pid:4242', { kind: 'pid', pid: 4242 }],
] as const)('it splits %s into the parts a probe passes', (ref, target) => {
  expect(parseCheckTarget(ref)).toStrictEqual(target);
});

test.each([['bogus:1'], ['pr:nohash'], ['branch:nopath']])('it reads %s as no target', (ref) => {
  expect(parseCheckTarget(ref)).toBeNull();
});
