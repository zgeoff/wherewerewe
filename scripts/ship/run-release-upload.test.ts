import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { formatChecksums } from '../binaries/format-checksums.ts';
import { runReleaseUpload } from './run-release-upload.ts';

function setupTest() {
  const root = createTempDir('run-release-upload').path;
  const calls: { argv: string[]; cwd: string }[] = [];
  const errors: string[] = [];
  const targets = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64'];

  mkdirSync(join(root, 'packages', 'cli'), { recursive: true });

  writeFileSync(
    join(root, 'packages', 'cli', 'package.json'),
    JSON.stringify({ name: '@wherewerewe/cli', version: '0.2.0' }),
  );

  return {
    calls,
    errors,
    root,
    targets,

    // each target's binary holds its own name; SHA256SUMS is the text given, the one that matches
    // the binaries when the text is "matching", and no file when it is null
    writeDist: (names: readonly string[], checksums: string | null = 'matching') => {
      mkdirSync(join(root, 'dist'), { recursive: true });

      for (const name of names) {
        writeFileSync(join(root, 'dist', name), name);
      }

      const matching = formatChecksums(
        names.map((name) => ({
          name,
          sha256: new Bun.CryptoHasher('sha256').update(name).digest('hex'),
        })),
      );

      const text = checksums === 'matching' ? matching : checksums;

      if (text !== null) {
        writeFileSync(join(root, 'dist', 'SHA256SUMS'), text);
      }
    },
    upload: (env: Record<string, string | undefined>, exitCode = 0) =>
      runReleaseUpload({
        root,
        env,
        runCommand: (argv, cwd) => {
          calls.push({ argv: [...argv], cwd });

          return Promise.resolve(exitCode);
        },
        writeError: (text) => {
          errors.push(text);
        },
      }),
  };
}

test('it attaches each binary and the checksums to the release of the package version at its tag', async () => {
  const ctx = setupTest();

  ctx.writeDist(ctx.targets.map((target) => `wherewerewe-${target}`));

  const code = await ctx.upload({
    GITHUB_REF: 'refs/tags/@wherewerewe/cli@0.2.0',
    GITHUB_REPOSITORY: 'acme/notes',
  });

  expect({ code, calls: ctx.calls, errors: ctx.errors }).toStrictEqual({
    code: 0,
    calls: [
      {
        argv: [
          'gh',
          'release',
          'upload',
          '@wherewerewe/cli@0.2.0',
          'dist/wherewerewe-darwin-arm64',
          'dist/wherewerewe-darwin-x64',
          'dist/wherewerewe-linux-arm64',
          'dist/wherewerewe-linux-x64',
          'dist/SHA256SUMS',
          '--clobber',
          '--repo',
          'acme/notes',
        ],
        cwd: ctx.root,
      },
    ],
    errors: [],
  });
});

test.each([
  ['a push to main', 'refs/heads/main'],
  ['another release tag', 'refs/tags/@wherewerewe/cli@0.1.0'],
  ['no ref', undefined],
])('it uploads nothing and exits 1 for %s', async (_title, ref) => {
  const ctx = setupTest();

  ctx.writeDist(ctx.targets.map((target) => `wherewerewe-${target}`));

  const code = await ctx.upload({ GITHUB_REF: ref, GITHUB_REPOSITORY: 'acme/notes' });

  expect({ code, commands: ctx.calls.length, errors: ctx.errors }).toStrictEqual({
    code: 1,
    commands: 0,
    errors: [
      `run-release-upload: the run is at ${ref ?? 'no ref'}, and a ship runs only at refs/tags/@wherewerewe/cli@0.2.0\n`,
    ],
  });
});

test.each([
  {
    title: 'only the binary of the host target',
    names: ['wherewerewe-linux-x64'],
    checksums: 'matching',
    error: 'dist/ holds [wherewerewe-linux-x64], and a release needs exactly',
  },
  {
    title: 'no binary',
    names: [],
    checksums: 'matching',
    error: 'dist/ holds [], and a release needs exactly',
  },
  {
    title: 'every binary and no SHA256SUMS',
    names: [
      'wherewerewe-darwin-arm64',
      'wherewerewe-darwin-x64',
      'wherewerewe-linux-arm64',
      'wherewerewe-linux-x64',
    ],
    checksums: null,
    error: 'dist/SHA256SUMS is missing or does not match the binaries in dist/',
  },
  {
    title: 'every binary and a SHA256SUMS that names one platform',
    names: [
      'wherewerewe-darwin-arm64',
      'wherewerewe-darwin-x64',
      'wherewerewe-linux-arm64',
      'wherewerewe-linux-x64',
    ],
    checksums: `${'1'.repeat(64)}  wherewerewe-linux-x64\n`,
    error: 'dist/SHA256SUMS is missing or does not match the binaries in dist/',
  },
])('it uploads nothing and exits 1 when dist holds $title', async (row) => {
  const ctx = setupTest();

  ctx.writeDist(row.names, row.checksums);

  const code = await ctx.upload({ GITHUB_REF: 'refs/tags/@wherewerewe/cli@0.2.0' });

  expect({
    code,
    commands: ctx.calls.length,
    errors: ctx.errors.map((error) => error.startsWith(`run-release-upload: ${row.error}`)),
  }).toStrictEqual({ code: 1, commands: 0, errors: [true] });
});

test('it passes on the exit code of the upload', async () => {
  const ctx = setupTest();

  ctx.writeDist(ctx.targets.map((target) => `wherewerewe-${target}`));

  const code = await ctx.upload({ GITHUB_REF: 'refs/tags/@wherewerewe/cli@0.2.0' }, 1);

  expect(code).toBe(1);
});
