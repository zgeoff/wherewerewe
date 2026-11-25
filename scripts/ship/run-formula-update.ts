import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildFormula } from './build-formula.ts';
import { buildReleaseTag } from './build-release-tag.ts';
import { findFormulaVersion } from './find-formula-version.ts';
import { findRefRefusal } from './find-ref-refusal.ts';
import { pickFormulaCommitMessage } from './pick-formula-commit-message.ts';
import { readReleaseVersion } from './read-release-version.ts';

// Runs one git step in a folder, or in the current one when the folder is null, and returns its
// exit code. The step's own output never reaches the caller, because git echoes the remote URL, and
// that URL holds the token.
type RunStep = (args: readonly string[], folder: string | null) => Promise<number>;

export interface RunFormulaUpdateOptions {
  readonly root: string;
  readonly workDir: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly runStep: RunStep;
  readonly writeOutput: (text: string) => void;
  readonly writeError: (text: string) => void;
}

const maxPushes = 3;
const botName = 'github-actions[bot]';
const botEmail = '41898282+github-actions[bot]@users.noreply.github.com';

// Commits the formula to the tap as the Actions bot, and pushes, with a pull and a second push after
// a rejection, three pushes at most. It runs only at the release's tag, and leaves a newer formula
// alone. A failed step prints a fixed line, never its arguments, which hold the token.
export async function runFormulaUpdate(options: RunFormulaUpdateOptions): Promise<number> {
  const version = await readReleaseVersion(options.root);

  const refusal = findRefRefusal(options.env['GITHUB_REF'], version);
  const token = options.env['GH_TOKEN'] ?? '';
  const tap = options.env['TAP'] ?? '';

  if (refusal !== null || token === '' || tap === '') {
    options.writeError(
      `run-formula-update: ${refusal ?? 'GH_TOKEN and TAP name the tap and its token'}\n`,
    );

    return 1;
  }

  const folder = join(options.workDir, 'tap');

  const step = async (name: string, args: readonly string[], at: string | null) => {
    const exitCode = await options.runStep(args, at);

    if (exitCode !== 0) {
      options.writeError(`run-formula-update: git ${name} exited ${String(exitCode)}\n`);
    }

    return exitCode;
  };

  const checksums = await Bun.file(join(options.root, 'dist', 'SHA256SUMS')).text();

  const formula = buildFormula({ version, tag: buildReleaseTag(version), checksums });
  const cloneURL = `https://x-access-token:${token}@github.com/${tap}.git`;

  const clone = await step('clone', ['clone', '--quiet', cloneURL, folder], null);

  if (clone !== 0) {
    return 1;
  }

  const formulaPath = join(folder, 'Formula', 'wherewerewe.rb');
  const tapFormula = existsSync(formulaPath) ? await Bun.file(formulaPath).text() : null;
  const tapVersion = tapFormula === null ? null : findFormulaVersion(tapFormula);

  if (tapVersion !== null && Bun.semver.order(tapVersion, version) === 1) {
    options.writeOutput(`formula already at ${tapVersion}, which is newer than ${version}\n`);

    return 0;
  }

  mkdirSync(join(folder, 'Formula'), { recursive: true });

  await Bun.write(formulaPath, formula);

  const prepared = [
    await step('config', ['config', 'user.name', botName], folder),
    await step('config', ['config', 'user.email', botEmail], folder),
    await step('add', ['add', 'Formula/wherewerewe.rb'], folder),
  ];

  if (prepared.some((exitCode) => exitCode !== 0)) {
    return 1;
  }

  const diffExitCode = await options.runStep(['diff', '--cached', '--quiet'], folder);

  const message = pickFormulaCommitMessage(diffExitCode, version);

  if (message === null) {
    options.writeOutput(`formula already at ${version}\n`);
  } else if ((await step('commit', ['commit', '--quiet', '-m', message], folder)) !== 0) {
    return 1;
  }

  return pushWithRetry(step, folder);
}

async function pushWithRetry(
  step: (name: string, args: readonly string[], at: string | null) => Promise<number>,
  folder: string,
): Promise<number> {
  for (let attempt = 1; attempt <= maxPushes; attempt += 1) {
    if ((await step('push', ['push', '--quiet'], folder)) === 0) {
      return 0;
    }

    if (
      attempt === maxPushes ||
      (await step('pull', ['pull', '--rebase', '--quiet'], folder)) !== 0
    ) {
      return 1;
    }
  }

  return 1;
}

if (import.meta.main) {
  process.exitCode = await runFormulaUpdate({
    root: process.cwd(),
    workDir: process.cwd(),
    env: process.env,
    runStep: (args, folder) =>
      Bun.spawn(['git', ...args], {
        ...(folder === null ? {} : { cwd: folder }),

        // a trace file would hold the clone URL and its token, so git gets no trace setting, from
        // the environment or from a global or system config
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([name]) => !name.startsWith('GIT_TRACE') && name !== 'GIT_CURL_VERBOSE',
            ),
          ),
          GIT_CONFIG_GLOBAL: '/dev/null',
          GIT_CONFIG_NOSYSTEM: '1',
        },
        stdio: ['ignore', 'ignore', 'ignore'],
      }).exited,
    writeOutput: (text) => {
      process.stdout.write(text);
    },
    writeError: (text) => {
      process.stderr.write(text);
    },
  });
}
