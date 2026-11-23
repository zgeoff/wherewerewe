import { expect, test } from 'bun:test';
import { findCredentialMatch } from './find-credential-match.ts';

test.each([
  ['token ghp_abc', 'ghp_'],
  ['gho_abc', 'gho_'],
  ['ghs_abc', 'ghs_'],
  ['ghu_abc', 'ghu_'],
  ['github_pat_abc', 'github_pat_'],
  ['xoxb-12', 'xoxb-'],
  ['xoxp-12', 'xoxp-'],
  ['sk-abcdefghijklmnopqrstuv', 'sk-'],
  ['ghr_abc', 'ghr_'],
  ['xoxa-1', 'xoxa-'],
  ['xoxr-1', 'xoxr-'],
  ['xapp-1', 'xapp-'],
  ['AKIAABCDEFGHIJKLMNOP', 'AKIA'],
  ['ops_abcdefghijklmnopqrstuvwx', 'ops_'],
  ['-----BEGIN PRIVATE KEY-----', '-----BEGIN'],
  ['eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl', 'eyJ'],
  ['glpat-abcdefghijklmnopqrstu', 'glpat-'],
  ['npm_abcdefghijklmnopqrstu', 'npm_'],
  ['sk_live_abcdefghijklmnopqrstu', 'sk_live_'],
  ['rk_live_abcdefghijklmnopqrstu', 'rk_live_'],
  ['AIzaabcdefghijklmnopqrstu', 'AIza'],
])('it names the label of %s', (text, label) => {
  expect(findCredentialMatch(text)).toBe(label);
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
