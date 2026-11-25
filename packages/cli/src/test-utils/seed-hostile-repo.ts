import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runGit } from '@zgeoff/testing/git';
import { seedGitRepo } from './seed-git-repo.ts';
import type { SeededRepo } from './seed-git-repo.ts';

// Each way a repo's own config can name a program that git might start while it reads the repo.
export const hostileSettings = [
  'filter.<d>.clean',
  'filter.<d>.process',
  'filter.<d>.smudge',
  'filter.<d>.clean in config.worktree',
  'filter.<d>.clean in an included file',
  'filter.<d> mapped in .git/info/attributes',
  'filter.<d>.clean in a submodule',
  'core.fsmonitor',
  'core.hooksPath',
  'diff.external',
  'diff.<d>.textconv',
  'core.pager',
  'pager.status',
  'credential.helper',
  'core.sshCommand',
  'core.askPass',
  'gpg.program',
  'core.alternateRefsCommand',
] as const;

export type HostileSetting = (typeof hostileSettings)[number];

export interface HostileRepo extends SeededRepo {
  // a file that exists only once the named program has run
  readonly marker: string;

  // the path a check names: the tracked file kiln.txt, touched after the setting is in place, or
  // for a submodule the work tree's folder, whose status reaches into the submodule
  readonly probed: string;
}

// The repo of seed-git-repo.ts, with kiln.txt mapped to the filter and diff driver x, one setting
// that names a program which creates the marker, then kiln.txt touched so git looks at it again.
// The program uses only shell builtins and an absolute cat, so it runs on any PATH.
export async function seedHostileRepo(root: string, setting: HostileSetting): Promise<HostileRepo> {
  const repo = await seedGitRepo(root);

  const marker = join(root, 'program-ran');
  const program = join(root, 'program.sh');
  const file = join(repo.folder, 'kiln.txt');

  writeFileSync(program, `#!/bin/sh\n: > "${marker}"\nexec /bin/cat\n`);
  chmodSync(program, 0o755);

  const attributes = '*.txt filter=x diff=x\n';

  if (setting === 'filter.<d> mapped in .git/info/attributes') {
    writeFileSync(join(repo.folder, '.git', 'info', 'attributes'), attributes);
  } else {
    writeFileSync(join(repo.folder, '.gitattributes'), attributes);

    await runGit(repo.folder, repo.env, ['add', '.gitattributes']);
    await runGit(repo.folder, repo.env, ['commit', '--quiet', '-m', 'map the drivers']);
    await runGit(repo.folder, repo.env, ['push', '--quiet']);
  }

  await writeSetting(repo, setting, program, root);

  writeFileSync(file, 'first\n');

  const probed = setting === 'filter.<d>.clean in a submodule' ? repo.folder : file;

  return { ...repo, marker, probed };
}

async function writeSetting(
  repo: SeededRepo,
  setting: HostileSetting,
  program: string,
  root: string,
): Promise<void> {
  const config = (key: string, value: string, extra: readonly string[] = []) =>
    runGit(repo.folder, repo.env, ['config', ...extra, key, value]);

  if (setting === 'filter.<d>.clean in config.worktree') {
    await config('extensions.worktreeConfig', 'true');
    await config('filter.x.clean', program, ['--worktree']);

    return;
  }

  if (setting === 'filter.<d>.clean in an included file') {
    const included = join(root, 'included.gitconfig');

    writeFileSync(included, `[filter "x"]\n\tclean = ${program}\n`);

    await config('include.path', included);

    return;
  }

  if (setting === 'filter.<d>.clean in a submodule') {
    await writeSubmodule(repo, program, root);

    return;
  }

  if (setting === 'core.hooksPath') {
    const hooks = join(root, 'hooks');

    mkdirSync(hooks, { recursive: true });
    writeFileSync(join(hooks, 'post-index-change'), `#!/bin/sh\nexec ${program} </dev/null\n`);
    chmodSync(join(hooks, 'post-index-change'), 0o755);

    await config('core.hooksPath', hooks);

    return;
  }

  const keys: Readonly<Record<string, string>> = {
    'filter.<d>.clean': 'filter.x.clean',
    'filter.<d>.process': 'filter.x.process',
    'filter.<d>.smudge': 'filter.x.smudge',
    'filter.<d> mapped in .git/info/attributes': 'filter.x.clean',
    'diff.<d>.textconv': 'diff.x.textconv',
    'credential.helper': 'credential.helper',
  };

  await config(keys[setting] ?? setting, program);
}

// A submodule sub, whose own config maps its tracked file to a filter driver that runs the program.
async function writeSubmodule(repo: SeededRepo, program: string, root: string): Promise<void> {
  const source = join(root, 'sub-source');

  mkdirSync(source, { recursive: true });

  await runGit(source, repo.env, ['init', '--quiet', '-b', 'main']);

  writeFileSync(join(source, 'buoy.txt'), 'first\n');
  writeFileSync(join(source, '.gitattributes'), '*.txt filter=x\n');

  await runGit(source, repo.env, ['add', '-A']);
  await runGit(source, repo.env, ['commit', '--quiet', '-m', 'add the buoy notes']);

  await runGit(repo.folder, repo.env, [
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    '--quiet',
    source,
    'sub',
  ]);

  await runGit(repo.folder, repo.env, ['commit', '--quiet', '-m', 'add the submodule']);
  await runGit(join(repo.folder, 'sub'), repo.env, ['config', 'filter.x.clean', program]);

  writeFileSync(join(repo.folder, 'sub', 'buoy.txt'), 'first\n');
}
