import { expect, test } from 'bun:test';
import { parseCheckRef } from './parse-check-ref.ts';

test.each([
  ['pr:acme/tool#12', 'pr:acme/tool#12'],
  ['pid:4242', 'pid:4242'],
  ['path:/srv/app', 'path:/srv/app'],
  ['branch:/srv/app@fix-it', 'branch:/srv/app@fix-it'],
  ['pr:acme/tool#0', null],
  ['pr:acme#1', null],
  ['pid:abc', null],
  ['path:srv/app', null],
  ['branch:/srv/app@', null],
  ['branch:srv/app@fix', null],
  ['branch:/srv/app@a b', null],
  ['url:/srv/app', null],
  ['pid4', null],
  ['', null],
])('it reads the check %p as %p', (text, expected) => {
  expect(parseCheckRef(text)).toBe(expected);
});
