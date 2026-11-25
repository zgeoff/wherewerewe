import { expect, test } from 'bun:test';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTempDir } from '@zgeoff/testing/fs';
import { $ } from 'bun';
import { buildFormula } from './build-formula.ts';
import { runFormulaUpdate } from './run-formula-update.ts';

function setupTest() {
  const root = createTempDir('run-formula-update').path;
  const work = createTempDir('run-formula-update-work').path;
  const token = ['tap', 'secret', '9'].join('-');
  const calls: { args: string[]; folder: string | null }[] = [];
  const output: string[] = [];
  const errors: string[] = [];

  mkdirSync(join(root, 'packages', 'cli'), { recursive: true });
  mkdirSync(join(root, 'dist'), { recursive: true });

  writeFileSync(
    join(root, 'packages', 'cli', 'package.json'),
    JSON.stringify({ name: '@wherewerewe/cli', version: '0.2.0' }),
  );

  const checksums = ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64']
    .map((target, at) => `${String(at + 1).repeat(64)}  wherewerewe-${target}\n`)
    .join('');

  writeFileSync(join(root, 'dist', 'SHA256SUMS'), checksums);

  return {
    root,
    work,
    token,
    calls,
    output,
    errors,
    checksums,
    env: {
      GITHUB_REF: 'refs/tags/@wherewerewe/cli@0.2.0',
      GH_TOKEN: token,
      TAP: 'acme/homebrew-tap',
    },

    // Each call of a step answers from the exit codes of its verb in order, then 0. A clone puts
    // the formula of the tap's version in the folder, when one is given.
    update: (
      env: Record<string, string | undefined>,
      exitCodes: Record<string, readonly number[]> = {},
      tapVersion: string | null = null,
    ) => {
      const used: Record<string, number> = {};

      return runFormulaUpdate({
        root,
        workDir: work,
        env,
        runStep: (args, folder) => {
          calls.push({ args: [...args], folder });

          const verb = args[0] ?? '';
          const at = used[verb] ?? 0;

          used[verb] = at + 1;

          if (verb === 'clone') {
            mkdirSync(join(args[3] ?? '', 'Formula'), { recursive: true });

            if (tapVersion !== null) {
              writeFileSync(
                join(args[3] ?? '', 'Formula', 'wherewerewe.rb'),
                buildFormula({
                  version: tapVersion,
                  tag: `@wherewerewe/cli@${tapVersion}`,
                  checksums,
                }),
              );
            }
          }

          return Promise.resolve(exitCodes[verb]?.[at] ?? (verb === 'diff' ? 1 : 0));
        },
        writeOutput: (text) => {
          output.push(text);
        },
        writeError: (text) => {
          errors.push(text);
        },
      });
    },

    // Runs the script through its real spawn of git, with a stub git that prints a remote URL with
    // the token to stdout and stderr on every call, as a real clone, pull or push may, and exits
    // with the code GIT_EXIT_<verb> gives; diff exits 1 by default, for a changed formula.
    runScript: async (
      exitCodes: Record<string, number> = {},
      extraEnv: Record<string, string> = {},
    ) => {
      const stubs = createTempDir('run-formula-update-stubs').path;
      const echoed = `https://x-access-token:${token}@github.com/acme/homebrew-tap.git`;

      writeFileSync(
        join(stubs, 'git'),
        `#!/bin/sh
echo "remote: ${echoed}"
echo "fatal: unable to access '${echoed}/'" >&2
for trace in "$GIT_TRACE" "$GIT_TRACE_CURL" "$GIT_TRACE_PACKET" "$GIT_TRACE_SETUP" "$GIT_TRACE2" "$GIT_TRACE2_EVENT" "$GIT_TRACE2_PERF"; do
  if [ -n "$trace" ]; then echo "trace: ${echoed}" >> "$trace"; fi
done
if [ -n "$CONFIG_TRACE" ] && { [ "$GIT_CONFIG_GLOBAL" != /dev/null ] || [ "$GIT_CONFIG_NOSYSTEM" != 1 ]; }; then
  echo "trace2: ${echoed}" >> "$CONFIG_TRACE"
fi
case "$1" in
  clone) mkdir -p "$4"; exit "\${GIT_EXIT_clone:-0}" ;;
  config) exit "\${GIT_EXIT_config:-0}" ;;
  add) exit "\${GIT_EXIT_add:-0}" ;;
  diff) exit "\${GIT_EXIT_diff:-1}" ;;
  commit) exit "\${GIT_EXIT_commit:-0}" ;;
  push) exit "\${GIT_EXIT_push:-0}" ;;
  pull) exit "\${GIT_EXIT_pull:-0}" ;;
esac
`,
        { mode: 0o755 },
      );

      const result = await $`${process.execPath} ${join(import.meta.dir, 'run-formula-update.ts')}`
        .cwd(root)
        .env({
          ...process.env,
          GITHUB_REF: 'refs/tags/@wherewerewe/cli@0.2.0',
          GH_TOKEN: token,
          TAP: 'acme/homebrew-tap',
          PATH: `${stubs}:/usr/bin:/bin`,
          ...Object.fromEntries(
            Object.entries(exitCodes).map(([verb, code]) => [`GIT_EXIT_${verb}`, String(code)]),
          ),
          ...extraEnv,
        })
        .nothrow()
        .quiet();

      return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    },
    readFormula: () => Bun.file(join(work, 'tap', 'Formula', 'wherewerewe.rb')).text(),
    probeTap: () => existsSync(join(work, 'tap')),
  };
}

test('it clones the tap, writes the formula, commits as the bot and pushes', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env);
  const formula = await ctx.readFormula();

  expect({ code, calls: ctx.calls, formula, errors: ctx.errors }).toStrictEqual({
    code: 0,
    calls: [
      {
        args: [
          'clone',
          '--quiet',
          `https://x-access-token:${ctx.token}@github.com/acme/homebrew-tap.git`,
          join(ctx.work, 'tap'),
        ],
        folder: null,
      },
      { args: ['config', 'user.name', 'github-actions[bot]'], folder: join(ctx.work, 'tap') },
      {
        args: ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
        folder: join(ctx.work, 'tap'),
      },
      { args: ['add', 'Formula/wherewerewe.rb'], folder: join(ctx.work, 'tap') },
      { args: ['diff', '--cached', '--quiet'], folder: join(ctx.work, 'tap') },
      { args: ['commit', '--quiet', '-m', 'wherewerewe 0.2.0'], folder: join(ctx.work, 'tap') },
      { args: ['push', '--quiet'], folder: join(ctx.work, 'tap') },
    ],
    formula: buildFormula({
      version: '0.2.0',
      tag: '@wherewerewe/cli@0.2.0',
      checksums: ctx.checksums,
    }),
    errors: [],
  });
});

test('it commits nothing when the formula is already at the version, and says so', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, { diff: [0] });

  expect({
    code,
    commits: ctx.calls.filter((call) => call.args[0] === 'commit').length,
    output: ctx.output,
  }).toStrictEqual({ code: 0, commits: 0, output: ['formula already at 0.2.0\n'] });
});

test('it pulls with a rebase after a rejected push, and pushes again', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, { push: [1, 0] });

  expect({ code, steps: ctx.calls.slice(5).map((call) => call.args) }).toStrictEqual({
    code: 0,
    steps: [
      ['commit', '--quiet', '-m', 'wherewerewe 0.2.0'],
      ['push', '--quiet'],
      ['pull', '--rebase', '--quiet'],
      ['push', '--quiet'],
    ],
  });
});

test('it gives up after three pushes, with two pulls between them, and exits 1', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, { push: [1, 1, 1, 1] });

  expect({
    code,
    steps: ctx.calls.slice(6).map((call) => call.args[0]),
  }).toStrictEqual({ code: 1, steps: ['push', 'pull', 'push', 'pull', 'push'] });
});

test('it exits 1 without a third push when the pull fails', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, { push: [1], pull: [1] });

  expect({
    code,
    steps: ctx.calls.slice(6).map((call) => call.args[0]),
  }).toStrictEqual({ code: 1, steps: ['push', 'pull'] });
});

test.each([
  { title: 'clone', failing: ['clone'], printed: ['clone'] },
  { title: 'config', failing: ['config'], printed: ['config'] },
  { title: 'add', failing: ['add'], printed: ['add'] },
  { title: 'commit', failing: ['commit'], printed: ['commit'] },
  { title: 'push', failing: ['push', 'push', 'push'], printed: ['push', 'push', 'push'] },
  { title: 'pull', failing: ['push', 'pull'], printed: ['push', 'pull'] },
])(
  'it prints one fixed line of the verb and exit code per failed step, and nothing else, when $title fails',
  async (row) => {
    const ctx = setupTest();

    const exitCodes = Object.fromEntries(
      [...new Set(row.failing)].map((verb) => [
        verb,
        row.failing.filter((name) => name === verb).map(() => 1),
      ]),
    );

    const code = await ctx.update(ctx.env, exitCodes);

    expect({ code, output: ctx.output, errors: ctx.errors }).toStrictEqual({
      code: 1,
      output: [],
      errors: row.printed.map((verb) => `run-formula-update: git ${verb} exited 1\n`),
    });
  },
);

test('it leaves the tap as it is, and exits 0, when its formula is newer than the release', async () => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, {}, '0.10.0');

  expect({
    code,
    steps: ctx.calls.map((call) => call.args[0]),
    output: ctx.output,
    formula: await ctx.readFormula(),
  }).toStrictEqual({
    code: 0,
    steps: ['clone'],
    output: ['formula already at 0.10.0, which is newer than 0.2.0\n'],
    formula: buildFormula({
      version: '0.10.0',
      tag: '@wherewerewe/cli@0.10.0',
      checksums: ctx.checksums,
    }),
  });
});

test.each([
  ['an older version', '0.1.9'],
  ['the same version', '0.2.0'],
])('it commits the formula over a tap that holds %s', async (_title, tapVersion) => {
  const ctx = setupTest();

  const code = await ctx.update(ctx.env, {}, tapVersion);

  expect({ code, steps: ctx.calls.map((call) => call.args[0]) }).toStrictEqual({
    code: 0,
    steps: ['clone', 'config', 'config', 'add', 'diff', 'commit', 'push'],
  });
});

test('it names the failed step by its verb and exit code', async () => {
  const ctx = setupTest();

  await ctx.update(ctx.env, { clone: [128] });

  expect(ctx.errors).toStrictEqual(['run-formula-update: git clone exited 128\n']);
});

test('it refuses a git diff that failed, never reading it as a formula in place', async () => {
  const ctx = setupTest();

  const error: unknown = await ctx
    .update(ctx.env, { diff: [128] })
    .catch((error_: unknown) => error_);

  expect(error).toMatchObject({ message: expect.stringContaining('git diff --cached exited 128') });
});

test.each([
  ['a push to main', 'refs/heads/main'],
  ['another release tag', 'refs/tags/@wherewerewe/cli@0.1.0'],
])('it clones nothing, writes nothing and exits 1 for %s', async (_title, ref) => {
  const ctx = setupTest();

  const code = await ctx.update({ ...ctx.env, GITHUB_REF: ref });

  expect({
    code,
    calls: ctx.calls.length,
    hasTap: ctx.probeTap(),
    errors: ctx.errors,
  }).toStrictEqual({
    code: 1,
    calls: 0,
    hasTap: false,
    errors: [
      `run-formula-update: the run is at ${ref}, and a ship runs only at refs/tags/@wherewerewe/cli@0.2.0\n`,
    ],
  });
});

test.each([
  ['no token', { GH_TOKEN: undefined }],
  ['an empty token', { GH_TOKEN: '' }],
  ['no tap', { TAP: undefined }],
])('it clones nothing and exits 1 with %s', async (_title, change) => {
  const ctx = setupTest();

  const code = await ctx.update({ ...ctx.env, ...change });

  expect({ code, calls: ctx.calls.length, errors: ctx.errors }).toStrictEqual({
    code: 1,
    calls: 0,
    errors: ['run-formula-update: GH_TOKEN and TAP name the tap and its token\n'],
  });
});

test.each([
  { title: 'every step succeeds', exitCodes: {}, exitCode: 0, stdout: '', stderr: '' },
  {
    title: 'the formula is unchanged',
    exitCodes: { diff: 0 },
    exitCode: 0,
    stdout: 'formula already at 0.2.0\n',
    stderr: '',
  },
  {
    title: 'the clone fails',
    exitCodes: { clone: 128 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git clone exited 128\n',
  },
  {
    title: 'a config fails',
    exitCodes: { config: 1 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git config exited 1\nrun-formula-update: git config exited 1\n',
  },
  {
    title: 'the add fails',
    exitCodes: { add: 1 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git add exited 1\n',
  },
  {
    title: 'the commit fails',
    exitCodes: { commit: 1 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git commit exited 1\n',
  },
  {
    title: 'every push fails',
    exitCodes: { push: 1 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git push exited 1\n'.repeat(3),
  },
  {
    title: 'the pull after a rejected push fails',
    exitCodes: { push: 1, pull: 1 },
    exitCode: 1,
    stdout: '',
    stderr: 'run-formula-update: git push exited 1\nrun-formula-update: git pull exited 1\n',
  },
])(
  'it prints none of what git prints, such as a remote URL that holds the token, when $title',
  async (row) => {
    const ctx = setupTest();

    const result = await ctx.runScript(row.exitCodes);

    expect(result).toStrictEqual({
      exitCode: row.exitCode,
      stdout: row.stdout,
      stderr: row.stderr,
    });
  },
);

test('it writes no git trace file, which would hold the token, when the environment asks for one', async () => {
  const ctx = setupTest();
  const traces = createTempDir('run-formula-update-traces').path;

  const result = await ctx.runScript(
    {},
    Object.fromEntries(
      [
        'GIT_TRACE',
        'GIT_TRACE_CURL',
        'GIT_TRACE_PACKET',
        'GIT_TRACE_SETUP',
        'GIT_TRACE2',
        'GIT_TRACE2_EVENT',
        'GIT_TRACE2_PERF',
      ].map((name) => [name, join(traces, name)]),
    ),
  );

  expect({ exitCode: result.exitCode, traces: readdirSync(traces) }).toStrictEqual({
    exitCode: 0,
    traces: [],
  });
});

test('it gives git no global or system config, whose trace settings would log the token', async () => {
  const ctx = setupTest();
  const traces = createTempDir('run-formula-update-config-traces').path;

  const result = await ctx.runScript({}, { CONFIG_TRACE: join(traces, 'trace2') });

  expect({ exitCode: result.exitCode, traces: readdirSync(traces) }).toStrictEqual({
    exitCode: 0,
    traces: [],
  });
});
