import { access, constants, mkdir, readFile } from 'node:fs/promises';
import { readRoot } from '../store/read-root.ts';
import type { Context } from '../types.ts';
import { readPaths } from './read-paths.ts';
import type { Step } from './types.ts';

export async function checkStore(context: Context): Promise<readonly Step[]> {
  const root = readRoot(context.env);
  const paths = readPaths(context.env);

  await mkdir(root, { recursive: true }).catch(() => null);

  const writable = await access(root, constants.W_OK).then(
    () => true,
    () => false,
  );

  const config = await readFile(paths.codexConfig, 'utf8').catch(() => null);

  const sandboxed = config !== null && !config.includes(root);

  return [
    {
      path: root,
      ok: writable,
      detail: writable ? 'this shell can write the store' : 'this shell cannot write the store',
    },
    {
      path: paths.codexConfig,
      ok: !sandboxed,
      detail: sandboxed
        ? `add under [sandbox_workspace_write]: writable_roots = ["${root}"], or a Codex write to the store fails`
        : 'Codex can write the store',
    },
  ];
}
