import { expect, test } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { runBinariesBuild } from './run-binaries-build.ts';

function setupTest() {
  const root = createTempDir('run-binaries-build').path;
  const calls: { argv: string[]; cwd: string }[] = [];

  return {
    root,
    outDir: join(root, 'dist'),
    calls,
    hashText: (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex'),

    // a compile that writes the outfile it is given, with the target as its content
    runWithStub: (targets: readonly string[], exitCodes: Record<string, number> = {}) =>
      runBinariesBuild({
        root,
        outDir: join(root, 'dist'),
        targets,
        runCommand: (argv, cwd) => {
          calls.push({ argv: [...argv], cwd });

          const outfile = argv.at(-1) ?? '';

          const target = (argv.find((word) => word.startsWith('--target=')) ?? '').slice(
            '--target=bun-'.length,
          );

          writeFileSync(outfile, target);

          return Promise.resolve(exitCodes[target] ?? 0);
        },
      }),
  };
}

test('it compiles each target given and writes SHA256SUMS over exactly those binaries', async () => {
  const ctx = setupTest();

  const code = await ctx.runWithStub(['linux-x64', 'darwin-arm64']);
  const sums = await Bun.file(join(ctx.outDir, 'SHA256SUMS')).text();

  expect({ code, cwds: ctx.calls.map((call) => call.cwd), sums }).toStrictEqual({
    code: 0,
    cwds: [ctx.root, ctx.root],
    sums: `${ctx.hashText('darwin-arm64')}  wherewerewe-darwin-arm64\n${ctx.hashText('linux-x64')}  wherewerewe-linux-x64\n`,
  });
});

test('it stops at the first target that fails to compile and writes no checksums', async () => {
  const ctx = setupTest();

  const code = await ctx.runWithStub(['linux-x64', 'darwin-x64'], { 'linux-x64': 3 });

  expect({
    code,
    compiled: ctx.calls.length,
    hasSums: existsSync(join(ctx.outDir, 'SHA256SUMS')),
  }).toStrictEqual({ code: 3, compiled: 1, hasSums: false });
});
