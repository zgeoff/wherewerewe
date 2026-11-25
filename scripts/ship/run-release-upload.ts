import { basename, join } from 'node:path';
import { buildReleaseTag } from './build-release-tag.ts';
import { findDistRefusal } from './find-dist-refusal.ts';
import { findRefRefusal } from './find-ref-refusal.ts';
import { readReleaseVersion } from './read-release-version.ts';

type RunCommand = (argv: readonly string[], cwd: string) => Promise<number>;

export interface RunReleaseUploadOptions {
  readonly root: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runCommand: RunCommand;
  readonly writeError: (text: string) => void;
}

// Attaches the built binaries and their checksums to the GitHub release of the package's version,
// and replaces any asset of the same name. It runs only at that release's tag, and only when dist/
// holds every target's binary and a SHA256SUMS that matches them.
export async function runReleaseUpload(options: RunReleaseUploadOptions): Promise<number> {
  const version = await readReleaseVersion(options.root);

  const refusal = findRefRefusal(options.env['GITHUB_REF'], version);

  if (refusal !== null) {
    options.writeError(`run-release-upload: ${refusal}\n`);

    return 1;
  }

  const binaries = [
    ...new Bun.Glob('dist/wherewerewe-*').scanSync({ cwd: options.root }),
  ].toSorted();

  const checksumsFile = Bun.file(join(options.root, 'dist', 'SHA256SUMS'));

  const hasChecksums = await checksumsFile.exists();

  const checksums = hasChecksums ? await checksumsFile.text() : null;

  const entries = await Promise.all(
    binaries.map(async (path) => {
      const bytes = await Bun.file(join(options.root, path)).arrayBuffer();

      return {
        name: basename(path),
        sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
      };
    }),
  );

  const distRefusal = findDistRefusal({ binaries: entries, checksums });

  if (distRefusal !== null) {
    options.writeError(`run-release-upload: ${distRefusal}\n`);

    return 1;
  }

  const repository = options.env['GITHUB_REPOSITORY'];

  return options.runCommand(
    [
      'gh',
      'release',
      'upload',
      buildReleaseTag(version),
      ...binaries,
      'dist/SHA256SUMS',
      '--clobber',
      ...(repository === undefined || repository === '' ? [] : ['--repo', repository]),
    ],
    options.root,
  );
}

if (import.meta.main) {
  process.exitCode = await runReleaseUpload({
    root: process.cwd(),
    env: process.env,
    runCommand: (argv, cwd) =>
      Bun.spawn([...argv], { cwd, stdio: ['ignore', 'inherit', 'inherit'] }).exited,
    writeError: (text) => {
      process.stderr.write(text);
    },
  });
}
