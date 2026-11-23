import { expect, test } from 'bun:test';
import { parseCheckFlags } from './parse-check-flags.ts';

test.each([
  [[], { kind: 'none' }],
  [
    [{ name: 'pr', value: 'acme/tool#77' }],
    { kind: 'check', ref: 'pr:acme/tool#77', flag: 'pr', value: 'acme/tool#77' },
  ],
  [
    [{ name: 'pid', value: '48211' }],
    { kind: 'check', ref: 'pid:48211', flag: 'pid', value: '48211' },
  ],
  [
    [{ name: 'path', value: '/srv/app' }],
    { kind: 'check', ref: 'path:/srv/app', flag: 'path', value: '/srv/app' },
  ],
  [
    [{ name: 'branch', value: '/srv/app@tz-fix' }],
    { kind: 'check', ref: 'branch:/srv/app@tz-fix', flag: 'branch', value: '/srv/app@tz-fix' },
  ],
  [
    [
      { name: 'pr', value: 'acme/tool#1' },
      { name: 'pid', value: '5' },
    ],
    { kind: 'too-many', first: { flag: 'pr', value: 'acme/tool#1' } },
  ],
  [[{ name: 'pr', value: 'acme/tool' }], { kind: 'malformed', flag: 'pr' }],
  [[{ name: 'pr', value: 'acme/tool#0' }], { kind: 'malformed', flag: 'pr' }],
  [[{ name: 'pid', value: 'abc' }], { kind: 'malformed', flag: 'pid' }],
  [[{ name: 'pid', value: '0' }], { kind: 'malformed', flag: 'pid' }],
  [[{ name: 'path', value: '' }], { kind: 'malformed', flag: 'path' }],
  [[{ name: 'branch', value: '/srv/app' }], { kind: 'malformed', flag: 'branch' }],
  [[{ name: 'branch', value: '/srv/app@' }], { kind: 'malformed', flag: 'branch' }],
  [[{ name: 'branch', value: '/srv/app@a b' }], { kind: 'malformed', flag: 'branch' }],
  [
    [{ name: 'path', value: 'src/lib' }],
    { kind: 'relative', flag: 'path', absolute: '/work/src/lib' },
  ],
  [
    [{ name: 'branch', value: '../app@fix' }],
    { kind: 'relative', flag: 'branch', absolute: '/app@fix' },
  ],
  [[{ name: 'who', value: 'owner' }], { kind: 'none' }],
])('it reads the check flags %p as %p', (flags, expected) => {
  const actual: unknown = parseCheckFlags(flags, '/work');

  expect(actual).toStrictEqual(expected);
});
