import { expect, test } from 'bun:test';
import { findCredentialMatch } from './find-credential-match.ts';

test.each([
  ['token ghp_abc', 'ghp'],
  ['gho_abc', 'gho'],
  ['ghs_abc', 'ghs'],
  ['ghu_abc', 'ghu'],
  ['github_pat_abc', 'github_pat'],
  ['xoxb-12', 'xoxb'],
  ['xoxp-12', 'xoxp'],
  ['sk-abcdefghijklmnopqrstuv', 'sk'],
  ['ghr_abc', 'ghr'],
  ['xoxa-1', 'xoxa'],
  ['xoxr-1', 'xoxr'],
  ['xapp-1', 'xapp'],
  [`AKIA${'Q'.repeat(16)}`, 'AKIA'],
  ['ops_abcdefghijklmnopqrstuvwx', 'ops'],
  ['-----BEGIN PRIVATE KEY-----', 'BEGIN'],
  ['eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl', 'eyJ'],
  [`glpat-${'a'.repeat(21)}`, 'glpat'],
  ['npm_abcdefghijklmnopqrstu', 'npm'],
  [`sk_live_${'a'.repeat(21)}`, 'sk_live'],
  [`rk_live_${'a'.repeat(21)}`, 'rk_live'],
  ['AIzaabcdefghijklmnopqrstu', 'AIza'],
])('it names the pattern of %s', (text, name) => {
  expect(findCredentialMatch(text)).toBe(name);
});

test.each([
  ['The staging secrets live in the vault bosun-staging'],
  ['sk-short'],
  ['AKIA1234'],
  ['ops_short'],
  ['Retry a 503 from the tide feed 3 times'],
])('it finds no credential in %s', (text) => {
  expect(findCredentialMatch(text)).toBeNull();
});
