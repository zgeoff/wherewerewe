import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { run } from '@zgeoff/testing/process';

function setupTest() {
  const folder = createTempDir('workspace-files').path;
  const workspace = join(folder, 'workspace');
  const state = join(folder, '.local', 'state');
  const bin = join(folder, 'bin');

  mkdirSync(workspace);
  mkdirSync(bin);
  linkCommands(bin, ['bun']);

  return {
    folder,
    workspace,
    state,
    runWWW: (argv: readonly string[]) =>
      run([join(import.meta.dir, '..', 'src', 'cli.ts'), ...argv], {
        cwd: workspace,
        env: { PATH: bin, HOME: folder },
      }),
  };
}

test('it reads no .env and runs no bunfig preload from the folder it runs in', async () => {
  const ctx = setupTest();
  const marker = join(ctx.folder, 'preload-ran');

  writeFileSync(join(ctx.workspace, '.env'), `XDG_STATE_HOME=${join(ctx.workspace, 'moved')}\n`);
  writeFileSync(join(ctx.workspace, 'bunfig.toml'), 'preload = ["./preload.ts"]\n');

  writeFileSync(
    join(ctx.workspace, 'preload.ts'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, '');\n`,
  );

  const started = await ctx.runWWW(['init', 'trial-files', '--goal', 'Ship the tide chart']);

  expect({
    exitCode: started.exitCode,
    inState: existsSync(join(ctx.state, 'wherewerewe', 'trial-files')),
    moved: existsSync(join(ctx.workspace, 'moved')),
    preloadRan: existsSync(marker),
  }).toStrictEqual({ exitCode: 0, inState: true, moved: false, preloadRan: false });
});
