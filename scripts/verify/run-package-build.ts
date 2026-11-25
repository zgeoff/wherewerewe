import { WringerError } from '@wringer/core';
import { allTargets } from '../binaries/all-targets.ts';
import { pickHostTarget } from '../binaries/pick-host-target.ts';
import { runBinariesBuild } from '../binaries/run-binaries-build.ts';

type RunCommand = (argv: readonly string[], cwd: string) => Promise<number>;

export interface RunPackageBuildOptions {
  readonly root: string;
  readonly releaseFolder: string;
  readonly platform: string;
  readonly arch: string;
  readonly runCommand: RunCommand;
}

// Compiles the binary for this machine into the release folder, with the SHA256SUMS that install.sh
// reads, and returns the target it built. It fails with `check-failed` when the compile fails, and
// with `usage` on a machine that has no binary.
export async function runPackageBuild(options: RunPackageBuildOptions): Promise<string> {
  const target = pickHostTarget(options.platform, options.arch);

  if (target === null || !allTargets.includes(target)) {
    throw new WringerError('usage', {
      message: `No binary builds for ${options.platform} on ${options.arch}.`,
    });
  }

  const code = await runBinariesBuild({
    root: options.root,
    outDir: options.releaseFolder,
    targets: [target],
    runCommand: options.runCommand,
  });

  if (code !== 0) {
    throw new WringerError('check-failed', {
      message: `bun build --compile for ${target} exited ${String(code)}.`,
    });
  }

  return target;
}
