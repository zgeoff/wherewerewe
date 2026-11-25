import { join } from 'node:path';

// A compiled binary otherwise loads .env and bunfig.toml, whose preload runs code, from the folder
// it starts in, the agent's repo for a hook. Bytecode moves the parse to the build, so a hook stays
// inside the agent's time limit; it needs the ESM format.
export function buildCompileArgv(target: string, outDir: string): string[] {
  return [
    'bun',
    'build',
    '--compile',
    '--bytecode',
    '--format=esm',
    '--no-compile-autoload-dotenv',
    '--no-compile-autoload-bunfig',
    `--target=bun-${target}`,
    'packages/cli/src/cli.ts',
    '--outfile',
    join(outDir, `wherewerewe-${target}`),
  ];
}
