import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runPackageBuild } from './run-package-build.ts';

function setupTest() {
  const root = createTempDir('run-package-build').path;
  const argvs: string[][] = [];

  return {
    root,
    releaseFolder: join(root, 'release'),
    argvs,
    runBuild: (platform: string, arch: string, exitCode = 0) =>
      runPackageBuild({
        root,
        releaseFolder: join(root, 'release'),
        platform,
        arch,
        runCommand: (argv) => {
          argvs.push([...argv]);

          writeFileSync(argv.at(-1) ?? '', 'binary');

          return Promise.resolve(exitCode);
        },
      }),
  };
}

test('it compiles the target of this machine into the release folder and returns the target', async () => {
  const ctx = setupTest();

  const target = await ctx.runBuild('linux', 'arm64');
  const sums = await Bun.file(join(ctx.releaseFolder, 'SHA256SUMS')).text();

  expect({
    target,
    compiled: ctx.argvs.map((argv) => argv.at(-1)),
    names: sums.split('\n').map((line) => line.slice(66)),
  }).toStrictEqual({
    target: 'linux-arm64',
    compiled: [join(ctx.releaseFolder, 'wherewerewe-linux-arm64')],
    names: ['wherewerewe-linux-arm64', ''],
  });
});

test('it fails with usage on a machine that has no binary', async () => {
  const ctx = setupTest();

  const error: unknown = await ctx.runBuild('win32', 'x64').catch((error_: unknown) => error_);

  expect(error).toMatchObject({ code: 'usage' });
});

test('it fails with check-failed when the compile exits other than 0', async () => {
  const ctx = setupTest();

  const error: unknown = await ctx.runBuild('linux', 'x64', 3).catch((error_: unknown) => error_);

  expect(error).toMatchObject({ code: 'check-failed' });
});
