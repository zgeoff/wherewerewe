import { expect, test } from 'bun:test';
import { formatChecksums } from '../binaries/format-checksums.ts';
import type { ChecksumEntry } from '../binaries/format-checksums.ts';
import { findDistRefusal } from './find-dist-refusal.ts';

function setupTest() {
  const names = [
    'wherewerewe-darwin-arm64',
    'wherewerewe-darwin-x64',
    'wherewerewe-linux-arm64',
    'wherewerewe-linux-x64',
  ];

  return {
    findDistRefusal,
    formatChecksums,
    names,
    buildEntries: (given: readonly string[]) =>
      given.map((name, at) => ({ name, sha256: String(at + 1).repeat(64) })),
  };
}

test('it accepts the binary of every target with a SHA256SUMS that matches them', () => {
  const ctx = setupTest();
  const binaries = ctx.buildEntries(ctx.names);

  expect(ctx.findDistRefusal({ binaries, checksums: ctx.formatChecksums(binaries) })).toBeNull();
});

test('it refuses a build of one target, even with a SHA256SUMS that matches it', () => {
  const ctx = setupTest();
  const binaries = ctx.buildEntries(['wherewerewe-linux-x64']);

  expect(ctx.findDistRefusal({ binaries, checksums: ctx.formatChecksums(binaries) })).toBe(
    'dist/ holds [wherewerewe-linux-x64], and a release needs exactly [wherewerewe-darwin-arm64, wherewerewe-darwin-x64, wherewerewe-linux-arm64, wherewerewe-linux-x64]',
  );
});

test('it refuses a binary that no target names', () => {
  const ctx = setupTest();
  const binaries = ctx.buildEntries([...ctx.names, 'wherewerewe-freebsd-x64']);

  expect(ctx.findDistRefusal({ binaries, checksums: ctx.formatChecksums(binaries) })).toStartWith(
    'dist/ holds [',
  );
});

test.each([
  {
    title: 'missing',
    pickChecksums: () => null,
  },
  {
    title: 'empty',
    pickChecksums: () => '',
  },
  {
    title: 'missing a platform',
    pickChecksums: (binaries: readonly ChecksumEntry[]) => formatChecksums(binaries.slice(1)),
  },
])('it refuses a SHA256SUMS that is $title', (row) => {
  const ctx = setupTest();
  const binaries = ctx.buildEntries(ctx.names);

  expect(ctx.findDistRefusal({ binaries, checksums: row.pickChecksums(binaries) })).toBe(
    'dist/SHA256SUMS is missing or does not match the binaries in dist/',
  );
});

test('it refuses a SHA256SUMS whose hash is not the hash of the binary', () => {
  const ctx = setupTest();
  const binaries = ctx.buildEntries(ctx.names);

  const checksums = ctx.formatChecksums(
    binaries.map((binary) => ({ ...binary, sha256: 'f'.repeat(64) })),
  );

  expect(ctx.findDistRefusal({ binaries, checksums })).toBe(
    'dist/SHA256SUMS is missing or does not match the binaries in dist/',
  );
});
