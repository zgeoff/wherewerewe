import { expect, test } from 'bun:test';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { createStubBin, linkCommands } from '@zgeoff/testing/bin';
import { createTempDir } from '@zgeoff/testing/fs';
import { $ } from 'bun';

function setupTest() {
  const root = createTempDir('install-script').path;
  const stubs = join(root, 'stubs');
  const release = join(root, 'release');
  const installDir = join(root, 'install', 'bin');
  const home = join(root, 'home');
  const script = join(import.meta.dir, 'install.sh');
  const releaseURL = 'https://downloads.example.test/wherewerewe';

  mkdirSync(stubs);
  mkdirSync(release);
  mkdirSync(installDir, { recursive: true });
  mkdirSync(home);

  // what the install script itself calls, so that a PATH of this folder alone reaches no other tool
  linkCommands(stubs, [
    'sh',
    'awk',
    'mkdir',
    'mktemp',
    'chmod',
    'mv',
    'ln',
    'rm',
    'rmdir',
    'readlink',
    'cp',
    'cat',
    'basename',
  ]);

  // a download that copies the file named by the end of the URL out of the release folder, to the
  // path after -o or to stdout, and fails like curl -f when the release holds no such file, with
  // curl's own diagnostic when -S is among its flags
  createStubBin(stubs, 'curl', {
    script: [
      '#!/bin/sh',
      "url=''; out=''; flags=''",
      'while [ $# -gt 0 ]; do',
      '  case "$1" in',
      '    -o) out="$2"; shift 2 ;;',
      '    -*) flags="$flags$1"; shift ;;',
      '    *) url="$1"; shift ;;',
      '  esac',
      'done',
      'src="$RELEASE_DIR/$(basename "$url")"',
      'if [ ! -f "$src" ]; then',
      '  case "$flags" in *S*) echo "curl: (22) The requested URL returned error: 404" >&2 ;; esac',
      '  exit 22',
      'fi',
      'if [ -n "$out" ]; then cp "$src" "$out"; else cat "$src"; fi',
    ].join('\n'),
  });

  const setUname = (os: string, machine: string) =>
    createStubBin(stubs, 'uname', {
      answers: [
        { args: ['-s'], stdout: `${os}\n` },
        { args: ['-m'], stdout: `${machine}\n` },
      ],
    });

  setUname('Linux', 'x86_64');

  const helpers = {
    hashText: (text: string) => new Bun.CryptoHasher('sha256').update(text).digest('hex'),
    buildBinary: (version: string) => `#!/bin/sh\necho "wherewerewe ${version}"\n`,
  };

  // each entry of a folder by name, with its content hash, its link target or a folder marker, to
  // compare two states
  const readSnapshot = (folder: string): Record<string, string> =>
    Object.fromEntries(
      readdirSync(folder)
        .toSorted()
        .map((name) => {
          const path = join(folder, name);
          const stat = lstatSync(path);

          if (stat.isSymbolicLink()) {
            return [name, `-> ${readlinkSync(path)}`];
          }

          return [
            name,
            stat.isDirectory() ? 'folder' : helpers.hashText(readFileSync(path, 'utf8')),
          ];
        }),
    );

  // every entry under the test folder by path, to prove that a failed run leaves nothing it made
  // anywhere; the stubs' call records and Bun's cache, which the stubs write, change on each run
  const readTree = (folder: string, prefix = '', tree: Record<string, string> = {}) => {
    for (const name of readdirSync(folder).toSorted()) {
      const path = join(folder, name);
      const key = `${prefix}${name}`;
      const stat = lstatSync(path);

      if (key === 'stubs' || key === 'home/.bun') {
        continue;
      }

      if (stat.isSymbolicLink()) {
        tree[key] = `-> ${readlinkSync(path)}`;
      } else if (stat.isDirectory()) {
        tree[key] = 'folder';

        readTree(path, `${key}/`, tree);
      } else {
        tree[key] = helpers.hashText(readFileSync(path, 'utf8'));
      }
    }

    return tree;
  };

  // puts a plain shell script in place of a command the script calls, so the script is the
  // command's own parent, as a kill of $PPID needs
  const breakCommand = (name: string, body: string) => {
    rmSync(join(stubs, name), { force: true });
    writeFileSync(join(stubs, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  };

  const ctx = {
    root,
    stubs,
    release,
    readTree,
    breakCommand,

    // empties the release folder, so the next publish holds only what it names
    clearRelease: () => {
      rmSync(release, { recursive: true, force: true });
      mkdirSync(release);
    },

    installDir,
    home,
    hashText: helpers.hashText,
    buildBinary: helpers.buildBinary,
    readSnapshot,
    setUname,
    linkSha256sum: () => {
      linkCommands(stubs, ['sha256sum']);
    },
    unlinkSha256sum: () => {
      rmSync(join(stubs, 'sha256sum'), { force: true });
    },

    // a sha256sum that prints the digest it is given and exits with the code
    stubSha256sum: (digest: string, exitCode: number) =>
      createStubBin(stubs, 'sha256sum', {
        answers: [{ args: [], stdout: `${digest}  -\n`, exitCode }],
      }),

    // puts a release in the release folder: the asset for each name, and SHA256SUMS over them
    // unless a text is given; a binary text replaces the stub that prints the version
    publish: (
      version: string,
      options: { sums?: string | null; asset?: string; binary?: string } = {},
    ) => {
      const asset = options.asset ?? 'wherewerewe-linux-x64';
      const binary = options.binary ?? helpers.buildBinary(version);

      writeFileSync(join(release, asset), binary);

      const others = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']
        .map((target) => `wherewerewe-${target}`)
        .filter((name) => name !== asset)
        .map((name) => `${'0'.repeat(64)}  ${name}\n`);

      const sums =
        options.sums === undefined
          ? [
              ...others.slice(0, 1),
              `${helpers.hashText(binary)}  ${asset}\n`,
              ...others.slice(1),
            ].join('')
          : options.sums;

      rmSync(join(release, 'SHA256SUMS'), { force: true });

      if (sums !== null) {
        writeFileSync(join(release, 'SHA256SUMS'), sums);
      }
    },
    install: async (env: Record<string, string> = {}) => {
      const result = await $`sh ${script}`
        .cwd(root)
        .env({
          ...process.env,
          PATH: stubs,
          HOME: home,
          RELEASE_DIR: release,
          WHEREWEREWE_RELEASE_URL: releaseURL,
          WHEREWEREWE_INSTALL_DIR: installDir,
          ...env,
        })
        .nothrow()
        .quiet();

      return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    },

    // the path of wherewerewe when the install folder leads PATH, and the version it prints
    probeInstalled: async () => {
      const lookup = { ...process.env, PATH: `${installDir}:${stubs}` };

      const found = await $`sh -c 'command -v wherewerewe'`.env(lookup).nothrow().quiet();

      const path = found.stdout.toString().trim();

      const ran = await $`${path}`.env(lookup).nothrow().quiet();

      return { path, version: ran.stdout.toString().trim() };
    },
  };

  // each way a run can fail once it has started to write, set up before the run, with the line the
  // run prints; a kill of the script runs its traps and prints nothing
  const failures = {
    'the binary download fails': {
      stderr: `wherewerewe: could not download ${releaseURL}/wherewerewe-linux-x64\n`,
      arrange: () => {
        ctx.clearRelease();
        ctx.publish('2.0.0', { asset: 'wherewerewe-darwin-arm64' });
      },
    },
    'the SHA256SUMS download fails': {
      stderr: `wherewerewe: could not download ${releaseURL}/SHA256SUMS\n`,
      arrange: () => {
        ctx.publish('2.0.0', { sums: null });
      },
    },
    'SHA256SUMS has no line for the asset': {
      stderr: 'wherewerewe: SHA256SUMS has no line for wherewerewe-linux-x64\n',
      arrange: () => {
        ctx.publish('2.0.0', { sums: `${'0'.repeat(64)}  wherewerewe-darwin-arm64\n` });
      },
    },
    'the download does not match its checksum': {
      stderr: "wherewerewe: wherewerewe-linux-x64 does not match the release's SHA256SUMS\n",
      arrange: () => {
        ctx.publish('2.0.0', { sums: `${'a'.repeat(64)}  wherewerewe-linux-x64\n` });
      },
    },
    'the machine has neither sha256sum nor shasum': {
      stderr: 'wherewerewe: needs sha256sum or shasum to check the download\n',
      arrange: () => {
        ctx.unlinkSha256sum();
        ctx.publish('2.0.0');
      },
    },
    'sha256sum fails': {
      stderr: 'wherewerewe: sha256sum could not hash the download\n',
      arrange: () => {
        ctx.publish('2.0.0');
        ctx.stubSha256sum(helpers.hashText(helpers.buildBinary('2.0.0')), 1);
      },
    },
    'the downloaded binary does not run': {
      stderr: 'wherewerewe: the downloaded binary does not run on this machine\n',
      arrange: () => {
        ctx.publish('2.0.0', { binary: '#!/bin/sh\nexit 3\n' });
      },
    },
    'mkdir fails': {
      stderr: 'mkdir: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('mkdir', 'echo "mkdir: failed" >&2; exit 1');
      },
    },
    'mktemp fails': {
      stderr: 'mktemp: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('mktemp', 'echo "mktemp: failed" >&2; exit 1');
      },
    },
    'mkdir makes the parent and then fails': {
      stderr: 'mkdir: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand(
          'mkdir',
          '/bin/mkdir -p "$(/usr/bin/dirname "$2")"; echo "mkdir: failed" >&2; exit 1',
        );
      },
    },
    'awk fails': {
      stderr: 'awk: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('awk', 'cat > /dev/null; echo "awk: failed" >&2; exit 2');
      },
    },
    'shasum fails on a machine with no sha256sum': {
      stderr: 'wherewerewe: shasum could not hash the download\n',
      arrange: () => {
        ctx.unlinkSha256sum();
        ctx.publish('2.0.0');

        breakCommand('shasum', 'exit 1');
      },
    },
    'chmod fails': {
      stderr: 'chmod: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('chmod', 'echo "chmod: failed" >&2; exit 1');
      },
    },
    'the downloaded binary changes itself when it runs': {
      stderr:
        "wherewerewe: wherewerewe-linux-x64 changed when it ran, so it no longer matches the release's SHA256SUMS\n",
      arrange: () => {
        ctx.publish('2.0.0', {
          binary: '#!/bin/sh\necho "# ran" >> "$0"\necho "wherewerewe 2.0.0"\n',
        });
      },
    },
    'mv fails': {
      stderr: 'mv: failed\n',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('mv', 'echo "mv: failed" >&2; exit 1');
      },
    },
    'the script is stopped with TERM during the download': {
      stderr: '',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('curl', 'kill -TERM "$PPID"; exit 0');
      },
    },
    'the script is stopped with INT during the download': {
      stderr: '',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('curl', 'kill -INT "$PPID"; exit 0');
      },
    },
    'the script is stopped with HUP during the download': {
      stderr: '',
      arrange: () => {
        ctx.publish('2.0.0');

        breakCommand('curl', 'kill -HUP "$PPID"; exit 0');
      },
    },
  };

  // each shape of WHEREWEREWE_INSTALL_DIR, as given, and the folder it names; the script runs in
  // the test folder, so a relative path names a folder there
  const nested = join(root, 'fresh', 'nested', 'bin');
  const spaced = join(root, 'fresh dir', 'nested bin');

  const installPaths = {
    'an absolute path': { given: nested, folder: nested },
    'a trailing slash': { given: `${nested}/`, folder: nested },
    'two trailing slashes': { given: `${nested}//`, folder: nested },
    'a relative path': { given: 'fresh/nested/bin', folder: nested },
    'dot parts': { given: './fresh/./nested/../nested//bin/', folder: nested },
    spaces: { given: spaced, folder: spaced },
    'a relative path with spaces': { given: 'fresh dir/nested bin/', folder: spaced },
  };

  return { ...ctx, failures, installPaths };
}

test('it installs the binary of the release for this machine, with www as a link to it', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
    files: ctx.readSnapshot(ctx.installDir),
    isExecutable: (statSync(join(ctx.installDir, 'wherewerewe')).mode & 0o111) !== 0,
  }).toStrictEqual({
    exitCode: 0,
    stderr: '',
    stdout: [
      'wherewerewe: downloading https://downloads.example.test/wherewerewe/wherewerewe-linux-x64',
      `wherewerewe: installed wherewerewe 1.0.0 to ${ctx.installDir}/wherewerewe`,
      `wherewerewe: add ${ctx.installDir} to your PATH`,
      '',
    ].join('\n'),
    files: {
      wherewerewe: ctx.hashText('#!/bin/sh\necho "wherewerewe 1.0.0"\n'),
      www: '-> wherewerewe',
    },
    isExecutable: true,
  });
});

test('it replaces the binary in place, so the path of wherewerewe stays the same', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  await ctx.install();

  const before = await ctx.probeInstalled();

  ctx.publish('2.0.0');

  const second = await ctx.install();
  const after = await ctx.probeInstalled();

  expect({
    exitCode: second.exitCode,
    before,
    after,
    files: Object.keys(ctx.readSnapshot(ctx.installDir)).toSorted(),
  }).toStrictEqual({
    exitCode: 0,
    before: { path: join(ctx.installDir, 'wherewerewe'), version: 'wherewerewe 1.0.0' },
    after: { path: join(ctx.installDir, 'wherewerewe'), version: 'wherewerewe 2.0.0' },
    files: ['wherewerewe', 'www'],
  });
});

test.each([
  {
    title: 'a download that does not match its checksum',
    sums: `${'a'.repeat(64)}  wherewerewe-linux-x64\n`,
    stderr: "wherewerewe: wherewerewe-linux-x64 does not match the release's SHA256SUMS\n",
  },
  {
    title: 'a SHA256SUMS with no line for the asset',
    sums: `${'a'.repeat(64)}  wherewerewe-darwin-arm64\n`,
    stderr: 'wherewerewe: SHA256SUMS has no line for wherewerewe-linux-x64\n',
  },
  {
    title: 'an empty SHA256SUMS',
    sums: '',
    stderr: 'wherewerewe: SHA256SUMS has no line for wherewerewe-linux-x64\n',
  },
  {
    title: 'a SHA256SUMS that fails to download',
    sums: null,
    stderr:
      'wherewerewe: could not download https://downloads.example.test/wherewerewe/SHA256SUMS\n',
  },
])(
  'it exits 1 with one line, and leaves the folder and an earlier install as they were, for $title',
  async (row) => {
    const ctx = setupTest();

    ctx.linkSha256sum();
    ctx.publish('1.0.0');

    await ctx.install();

    const before = ctx.readSnapshot(ctx.installDir);

    ctx.publish('2.0.0', { sums: row.sums });

    const result = await ctx.install();
    const installed = await ctx.probeInstalled();

    expect({
      exitCode: result.exitCode,
      stderr: result.stderr,
      files: ctx.readSnapshot(ctx.installDir),
      version: installed.version,
    }).toStrictEqual({
      exitCode: 1,
      stderr: row.stderr,
      files: before,
      version: 'wherewerewe 1.0.0',
    });
  },
);

test('it exits 1 and leaves the folder as it was when the binary fails to download', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0', { asset: 'wherewerewe-darwin-arm64' });

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: readdirSync(ctx.installDir),
  }).toStrictEqual({
    exitCode: 1,
    stderr:
      'wherewerewe: could not download https://downloads.example.test/wherewerewe/wherewerewe-linux-x64\n',
    files: [],
  });
});

test('it exits 1 and keeps an earlier install on a machine with neither sha256sum nor shasum', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  await ctx.install();

  const before = ctx.readSnapshot(ctx.installDir);

  ctx.unlinkSha256sum();
  ctx.publish('2.0.0');

  const result = await ctx.install();
  const installed = await ctx.probeInstalled();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: ctx.readSnapshot(ctx.installDir),
    version: installed.version,
  }).toStrictEqual({
    exitCode: 1,
    stderr: 'wherewerewe: needs sha256sum or shasum to check the download\n',
    files: before,
    version: 'wherewerewe 1.0.0',
  });
});

test('it exits 1 and keeps an earlier install when sha256sum fails after printing the expected digest', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  await ctx.install();

  const before = ctx.readSnapshot(ctx.installDir);

  ctx.publish('2.0.0');
  ctx.stubSha256sum(ctx.hashText('#!/bin/sh\necho "wherewerewe 2.0.0"\n'), 1);

  const result = await ctx.install();
  const installed = await ctx.probeInstalled();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: ctx.readSnapshot(ctx.installDir),
    version: installed.version,
  }).toStrictEqual({
    exitCode: 1,
    stderr: 'wherewerewe: sha256sum could not hash the download\n',
    files: before,
    version: 'wherewerewe 1.0.0',
  });
});

test('it exits 1 and keeps an earlier install when the download is a binary that does not run', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  await ctx.install();

  const before = ctx.readSnapshot(ctx.installDir);

  ctx.publish('2.0.0', { binary: '#!/bin/sh\nexit 3\n' });

  const result = await ctx.install();
  const installed = await ctx.probeInstalled();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: ctx.readSnapshot(ctx.installDir),
    version: installed.version,
  }).toStrictEqual({
    exitCode: 1,
    stderr: 'wherewerewe: the downloaded binary does not run on this machine\n',
    files: before,
    version: 'wherewerewe 1.0.0',
  });
});

test.each([
  {
    title: 'a folder',
    makeObstacle: (path: string) => {
      mkdirSync(path);
    },
  },
  {
    title: 'a link to a folder',
    makeObstacle: (path: string) => {
      mkdirSync(`${path}.target`);
      symlinkSync(`${path}.target`, path);
    },
  },
])('it exits 1 and replaces nothing when $title stands where the binary goes', async (row) => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');
  row.makeObstacle(join(ctx.installDir, 'wherewerewe'));

  const before = ctx.readSnapshot(ctx.installDir);

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: ctx.readSnapshot(ctx.installDir),
  }).toStrictEqual({
    exitCode: 1,
    stderr: `wherewerewe: ${ctx.installDir}/wherewerewe is a folder, and the script leaves it\n`,
    files: before,
  });
});

test.each([
  {
    title: 'a download that fails',
    sums: undefined,
    asset: 'wherewerewe-darwin-arm64',
    stderr: (url: string) => `wherewerewe: could not download ${url}/wherewerewe-linux-x64\n`,
  },
  {
    title: 'a download that does not match its checksum',
    sums: `${'a'.repeat(64)}  wherewerewe-linux-x64\n`,
    asset: undefined,
    stderr: () => "wherewerewe: wherewerewe-linux-x64 does not match the release's SHA256SUMS\n",
  },
])('it removes the install folder it made and prints one line for $title', async (row) => {
  const ctx = setupTest();
  const fresh = join(ctx.root, 'fresh', 'nested', 'bin');

  ctx.linkSha256sum();

  ctx.publish('1.0.0', {
    ...(row.asset === undefined ? {} : { asset: row.asset }),
    ...(row.sums === undefined ? {} : { sums: row.sums }),
  });

  const result = await ctx.install({ WHEREWEREWE_INSTALL_DIR: fresh });

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    isFolderLeft: existsSync(join(ctx.root, 'fresh')),
  }).toStrictEqual({
    exitCode: 1,
    stderr: row.stderr('https://downloads.example.test/wherewerewe'),
    isFolderLeft: false,
  });
});

test('it removes every folder it made when the install folder ends in a slash and the download fails', async () => {
  const ctx = setupTest();
  const fresh = `${join(ctx.root, 'fresh', 'nested', 'bin')}/`;

  ctx.linkSha256sum();
  ctx.publish('1.0.0', { asset: 'wherewerewe-darwin-arm64' });

  const result = await ctx.install({ WHEREWEREWE_INSTALL_DIR: fresh });

  expect({
    exitCode: result.exitCode,
    isFolderLeft: existsSync(join(ctx.root, 'fresh')),
  }).toStrictEqual({
    exitCode: 1,
    isFolderLeft: false,
  });
});

test('it checks the download with shasum when sha256sum is missing', async () => {
  const ctx = setupTest();
  const binary = '#!/bin/sh\necho "wherewerewe 1.0.0"\n';

  ctx.publish('1.0.0');

  createStubBin(ctx.stubs, 'shasum', {
    answers: [{ args: ['-a', '256'], stdout: `${ctx.hashText(binary)}  -\n` }],
  });

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    files: Object.keys(ctx.readSnapshot(ctx.installDir)).toSorted(),
  }).toStrictEqual({
    exitCode: 0,
    files: ['wherewerewe', 'www'],
  });
});

test('it leaves a www that is not a link to wherewerewe, and says so', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  writeFileSync(join(ctx.installDir, 'www'), 'another tool\n');

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    www: readFileSync(join(ctx.installDir, 'www'), 'utf8'),
    isLink: lstatSync(join(ctx.installDir, 'www')).isSymbolicLink(),
    said: result.stdout.includes(
      `wherewerewe: ${ctx.installDir}/www is not a link to wherewerewe, so the script leaves it.\n`,
    ),
    installed: existsSync(join(ctx.installDir, 'wherewerewe')),
  }).toStrictEqual({
    exitCode: 0,
    www: 'another tool\n',
    isLink: false,
    said: true,
    installed: true,
  });
});

test('it leaves a www that is a link to another file', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  symlinkSync('/opt/other-tool', join(ctx.installDir, 'www'));

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    target: readlinkSync(join(ctx.installDir, 'www')),
  }).toStrictEqual({
    exitCode: 0,
    target: '/opt/other-tool',
  });
});

test.each([
  { os: 'Darwin', machine: 'arm64', asset: 'wherewerewe-darwin-arm64' },
  { os: 'Darwin', machine: 'x86_64', asset: 'wherewerewe-darwin-x64' },
  { os: 'Linux', machine: 'aarch64', asset: 'wherewerewe-linux-arm64' },
  { os: 'Linux', machine: 'amd64', asset: 'wherewerewe-linux-x64' },
])('it installs $asset on $os with $machine', async (row) => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.setUname(row.os, row.machine);
  ctx.publish('1.0.0', { asset: row.asset });

  const result = await ctx.install();

  expect({ exitCode: result.exitCode, first: result.stdout.split('\n')[0] }).toStrictEqual({
    exitCode: 0,
    first: `wherewerewe: downloading https://downloads.example.test/wherewerewe/${row.asset}`,
  });
});

test.each([
  { os: 'FreeBSD', machine: 'x86_64', value: 'FreeBSD' },
  { os: 'Linux', machine: 'riscv64', value: 'riscv64' },
])('it exits 1 for $value, which has no binary, and writes nothing', async (row) => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.setUname(row.os, row.machine);
  ctx.publish('1.0.0');

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: readdirSync(ctx.installDir),
  }).toStrictEqual({ exitCode: 1, stderr: `wherewerewe: no binary for ${row.value}\n`, files: [] });
});

test('it does not ask for a PATH change when the install folder is on PATH', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  const result = await ctx.install({ PATH: `${ctx.stubs}:${ctx.installDir}` });

  expect({
    exitCode: result.exitCode,
    asksForPath: result.stdout.includes('to your PATH'),
  }).toStrictEqual({
    exitCode: 0,
    asksForPath: false,
  });
});

test('it writes nothing outside the install folder and edits no shell profile', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  for (const profile of ['.profile', '.bashrc', '.zshrc']) {
    writeFileSync(join(ctx.home, profile), `# ${profile} of a person\n`);
  }

  const readProfiles = () =>
    ['.profile', '.bashrc', '.zshrc'].map((profile) =>
      ctx.hashText(readFileSync(join(ctx.home, profile), 'utf8')),
    );

  const before = readProfiles();
  const rootBefore = readdirSync(ctx.root).toSorted();

  await ctx.install();

  expect({ profiles: readProfiles(), root: readdirSync(ctx.root).toSorted() }).toStrictEqual({
    profiles: before,
    root: rootBefore,
  });
});

test.each(
  (
    [
      'the binary download fails',
      'the SHA256SUMS download fails',
      'SHA256SUMS has no line for the asset',
      'the download does not match its checksum',
      'the machine has neither sha256sum nor shasum',
      'sha256sum fails',
      'the downloaded binary does not run',
      'mkdir fails',
      'mktemp fails',
      'mkdir makes the parent and then fails',
      'awk fails',
      'shasum fails on a machine with no sha256sum',
      'chmod fails',
      'the downloaded binary changes itself when it runs',
      'mv fails',
      'the script is stopped with TERM during the download',
      'the script is stopped with INT during the download',
      'the script is stopped with HUP during the download',
    ] as const
  ).flatMap((point) =>
    (
      [
        'an absolute path',
        'a trailing slash',
        'two trailing slashes',
        'a relative path',
        'dot parts',
        'spaces',
        'a relative path with spaces',
      ] as const
    ).flatMap((shape) =>
      [false, true].map((hasEarlierInstall) => ({ point, shape, hasEarlierInstall })),
    ),
  ),
)(
  'it leaves every file and folder as it was when $point, for $shape, with an earlier install: $hasEarlierInstall',
  async (row) => {
    const ctx = setupTest();
    const failure = ctx.failures[row.point];
    const installDir = ctx.installPaths[row.shape].given;

    ctx.linkSha256sum();

    if (row.hasEarlierInstall) {
      ctx.publish('1.0.0');

      await ctx.install({ WHEREWEREWE_INSTALL_DIR: installDir });
    }

    failure.arrange();

    const before = ctx.readTree(ctx.root);

    const result = await ctx.install({ WHEREWEREWE_INSTALL_DIR: installDir });

    expect({
      isFailed: result.exitCode !== 0,
      stderr: result.stderr,
      tree: ctx.readTree(ctx.root),
    }).toStrictEqual({
      isFailed: true,
      stderr: failure.stderr,
      tree: before,
    });
  },
);

test.each([
  'an absolute path',
  'a trailing slash',
  'two trailing slashes',
  'a relative path',
  'dot parts',
  'spaces',
  'a relative path with spaces',
] as const)('it installs into the folder that %s names', async (shape) => {
  const ctx = setupTest();
  const path = ctx.installPaths[shape];

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  const result = await ctx.install({ WHEREWEREWE_INSTALL_DIR: path.given });

  expect({
    exitCode: result.exitCode,
    installedLine: result.stdout.split('\n')[1],
    files: ctx.readSnapshot(path.folder),
  }).toStrictEqual({
    exitCode: 0,
    installedLine: `wherewerewe: installed wherewerewe 1.0.0 to ${path.folder}/wherewerewe`,
    files: { wherewerewe: ctx.hashText(ctx.buildBinary('1.0.0')), www: '-> wherewerewe' },
  });
});

test('it keeps a www that links to the absolute path of wherewerewe when the rename fails', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  await ctx.install();

  rmSync(join(ctx.installDir, 'www'));
  symlinkSync(join(ctx.installDir, 'wherewerewe'), join(ctx.installDir, 'www'));

  ctx.publish('2.0.0');
  ctx.breakCommand('mv', 'exit 1');

  const before = ctx.readTree(ctx.root);

  const result = await ctx.install();

  expect({ exitCode: result.exitCode, tree: ctx.readTree(ctx.root) }).toStrictEqual({
    exitCode: 1,
    tree: before,
  });
});

test('it installs the binary and says so when the www link cannot be made', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');
  ctx.breakCommand('ln', 'exit 1');

  const result = await ctx.install();

  expect({
    exitCode: result.exitCode,
    stderr: result.stderr,
    files: ctx.readSnapshot(ctx.installDir),
  }).toStrictEqual({
    exitCode: 0,
    stderr: `wherewerewe: could not make ${ctx.installDir}/www a link to wherewerewe, so type wherewerewe in place of www\n`,
    files: { wherewerewe: ctx.hashText(ctx.buildBinary('1.0.0')) },
  });
});

test('it renames the binary into place before it makes the www link', async () => {
  const ctx = setupTest();
  const order = join(ctx.root, 'order');

  ctx.linkSha256sum();
  ctx.publish('1.0.0');
  ctx.breakCommand('mv', `echo mv >> '${order}'; exec /bin/mv "$@"`);
  ctx.breakCommand('ln', `echo ln >> '${order}'; exec /bin/ln "$@"`);

  const result = await ctx.install();

  expect({ exitCode: result.exitCode, order: readFileSync(order, 'utf8') }).toStrictEqual({
    exitCode: 0,
    order: 'mv\nln\n',
  });
});

test('it resolves a .. after a linked folder the way the file system does', async () => {
  const ctx = setupTest();

  ctx.linkSha256sum();
  ctx.publish('1.0.0');

  mkdirSync(join(ctx.root, 'actual', 'inside'), { recursive: true });
  symlinkSync(join(ctx.root, 'actual', 'inside'), join(ctx.root, 'link'));

  const result = await ctx.install({ WHEREWEREWE_INSTALL_DIR: 'link/../bin/' });

  expect({
    exitCode: result.exitCode,
    installed: existsSync(join(ctx.root, 'actual', 'bin', 'wherewerewe')),
    isWrongFolder: existsSync(join(ctx.root, 'bin')),
  }).toStrictEqual({ exitCode: 0, installed: true, isWrongFolder: false });
});

test('it prints no user name or password that the release URL holds', async () => {
  const ctx = setupTest();
  const secret = ['dummy', 'pass', 'word'].join('-');

  ctx.linkSha256sum();
  ctx.clearRelease();

  const result = await ctx.install({
    WHEREWEREWE_RELEASE_URL: `https://reader:${secret}@downloads.example.test/wherewerewe/`,
  });

  expect({ exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr }).toStrictEqual(
    {
      exitCode: 1,
      stdout:
        'wherewerewe: downloading https://downloads.example.test/wherewerewe/wherewerewe-linux-x64\n',
      stderr:
        'wherewerewe: could not download https://downloads.example.test/wherewerewe/wherewerewe-linux-x64\n',
    },
  );
});
