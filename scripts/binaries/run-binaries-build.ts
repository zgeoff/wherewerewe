import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { allTargets } from './all-targets.ts';
import { buildCompileArgv } from './build-compile-argv.ts';
import { formatChecksums } from './format-checksums.ts';

type RunCommand = (argv: readonly string[], cwd: string) => Promise<number>;

export interface RunBinariesBuildOptions {
  readonly root: string;
  readonly outDir: string;
  readonly targets: readonly string[];
  readonly runCommand: RunCommand;
}

// Compiles one binary per target into the output folder, which it empties first, and writes
// SHA256SUMS over the binaries it built. Every target cross-compiles from any host.
export async function runBinariesBuild(options: RunBinariesBuildOptions): Promise<number> {
  rmSync(options.outDir, { recursive: true, force: true });
  mkdirSync(options.outDir, { recursive: true });

  for (const target of options.targets) {
    const code = await options.runCommand(buildCompileArgv(target, options.outDir), options.root);

    if (code !== 0) {
      return code;
    }
  }

  const entries = await Promise.all(
    readdirSync(options.outDir)
      .filter((name) => name.startsWith('wherewerewe-'))
      .map(async (name) => {
        const bytes = await Bun.file(join(options.outDir, name)).arrayBuffer();

        return { name, sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex') };
      }),
  );

  await Bun.write(join(options.outDir, 'SHA256SUMS'), formatChecksums(entries));

  return 0;
}

if (import.meta.main) {
  const root = join(import.meta.dir, '..', '..');
  const given = process.argv.slice(2);

  process.exitCode = await runBinariesBuild({
    root,
    outDir: join(root, 'dist'),
    targets: given.length === 0 ? allTargets : given,
    runCommand: (argv, cwd) =>
      Bun.spawn([...argv], { cwd, stdio: ['ignore', 'inherit', 'inherit'] }).exited,
  });
}
