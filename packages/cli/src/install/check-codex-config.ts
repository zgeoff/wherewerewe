import { isAbsolute, relative } from 'node:path';
import { isRecord } from '../hooks/is-record.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import { parseTOMLConfig } from './parse-toml-config.ts';
import type { DoctorCheck } from './types.ts';

export interface CodexConfigLayer {
  readonly shown: string;

  // `null` for a file that does not exist
  readonly text: string | null;
}

export interface CodexConfigInput {
  readonly user: CodexConfigLayer;
  readonly project: CodexConfigLayer;

  // the folder the command runs in, which the user file may mark as a trusted project
  readonly cwd: string;
  readonly storeRoot: string;
}

// Checks `config.toml`: it does not turn hooks off (a missing `hooks` line passes, since hooks are
// on by default), and it lists the store root in `writable_roots`. A project file in a folder the
// user file trusts overrides the user file's `hooks` and `writable_roots`.
export function checkCodexConfig(input: CodexConfigInput): DoctorCheck {
  const user = parseTOMLConfig(input.user.text ?? '');

  if (user === null) {
    return buildFailedCheck([
      `www doctor: ${input.user.shown} is not TOML that doctor can read.`,
      'Run: www install --print',
    ]);
  }

  const isProjectTrusted = input.project.text !== null && isTrustedFolder(user, input.cwd);
  const project = isProjectTrusted ? parseTOMLConfig(input.project.text ?? '') : null;

  if (isProjectTrusted && project === null) {
    return buildFailedCheck([
      `www doctor: ${input.project.shown} is not TOML that doctor can read.`,
      `Fix or remove ${input.project.shown}.`,
    ]);
  }

  const layers = [
    { shown: input.user.shown, config: user },
    ...(project === null ? [] : [{ shown: input.project.shown, config: project }]),
  ];

  const hooksLayer = layers.findLast((layer) => readHooks(layer.config) !== undefined);
  const rootsLayer = layers.findLast((layer) => readRoots(layer.config) !== undefined);
  const roots = rootsLayer === undefined ? undefined : readRoots(rootsLayer.config);

  const problems = [
    ...(hooksLayer !== undefined && readHooks(hooksLayer.config) === false
      ? [
          `www doctor: ${hooksLayer.shown} turns hooks off with hooks = false.`,
          `Set hooks = true under [features] in ${hooksLayer.shown}.`,
        ]
      : []),
    ...(Array.isArray(roots) && roots.includes(input.storeRoot)
      ? []
      : [
          `www doctor: ${rootsLayer?.shown ?? input.user.shown} does not list ${input.storeRoot} in writable_roots, so a Codex write to the store fails in the sandbox.`,
          'Run: www install --print',
        ]),
  ];

  if (problems.length > 0) {
    return buildFailedCheck(problems);
  }

  return {
    isOk: true,
    lines: [`ok: ${input.user.shown} leaves hooks on and lists the store root`],
  };
}

// Codex trusts a project by the path of its folder, in the user file's `projects` table.
function isTrustedFolder(user: Readonly<Record<string, unknown>>, cwd: string): boolean {
  const projects = user['projects'];

  if (!isRecord(projects)) {
    return false;
  }

  return Object.entries(projects).some(([path, entry]) => {
    const fromProject = relative(path, cwd);

    return (
      isAbsolute(path) &&
      isRecord(entry) &&
      entry['trust_level'] === 'trusted' &&
      fromProject !== '..' &&
      !fromProject.startsWith('../') &&
      !isAbsolute(fromProject)
    );
  });
}

function readHooks(config: Readonly<Record<string, unknown>>): unknown {
  const features = config['features'];

  return isRecord(features) ? features['hooks'] : undefined;
}

function readRoots(config: Readonly<Record<string, unknown>>): unknown {
  const sandbox = config['sandbox_workspace_write'];

  return isRecord(sandbox) ? sandbox['writable_roots'] : undefined;
}
