import { expect, test } from 'bun:test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { readReleaseVersion } from './read-release-version.ts';

function setupTest() {
  const root = createTempDir('read-release-version').path;

  mkdirSync(join(root, 'packages', 'cli'), { recursive: true });

  return {
    root,
    writeManifest: (manifest: unknown) =>
      Bun.write(join(root, 'packages', 'cli', 'package.json'), JSON.stringify(manifest)),
    readReleaseVersion,
  };
}

test('it reads the version from the package manifest', async () => {
  const ctx = setupTest();

  await ctx.writeManifest({ name: '@wherewerewe/cli', version: '0.4.1' });

  const version = await ctx.readReleaseVersion(ctx.root);

  expect(version).toBe('0.4.1');
});

test('it rejects a manifest with no version', async () => {
  const ctx = setupTest();

  await ctx.writeManifest({ name: '@wherewerewe/cli' });

  const error: unknown = await ctx.readReleaseVersion(ctx.root).catch((error_: unknown) => error_);

  expect(error).toBeInstanceOf(Error);
});
