import { isRecord } from '../hooks/is-record.ts';
import { buildFailedCheck } from './build-failed-check.ts';
import { parseTOMLConfig } from './parse-toml-config.ts';
import type { DoctorCheck } from './types.ts';

// Checks `config.toml`: it does not turn hooks off (a missing `hooks` line passes, since hooks are
// on by default), and it lists the store root in `writable_roots`.
export function checkCodexConfig(
  text: string | null,
  shown: string,
  storeRoot: string,
): DoctorCheck {
  const config = parseTOMLConfig(text ?? '');

  if (config === null) {
    return buildFailedCheck([
      `www doctor: ${shown} is not TOML that doctor can read.`,
      'Run: www install --print',
    ]);
  }

  const features = config['features'];
  const sandbox = config['sandbox_workspace_write'];
  const roots = isRecord(sandbox) ? sandbox['writable_roots'] : undefined;

  const problems = [
    ...(isRecord(features) && features['hooks'] === false
      ? [
          `www doctor: ${shown} turns hooks off with hooks = false.`,
          `Set hooks = true under [features] in ${shown}.`,
        ]
      : []),
    ...(Array.isArray(roots) && roots.includes(storeRoot)
      ? []
      : [
          `www doctor: ${shown} does not list ${storeRoot} in writable_roots, so a Codex write to the store fails in the sandbox.`,
          'Run: www install --print',
        ]),
  ];

  if (problems.length > 0) {
    return buildFailedCheck(problems);
  }

  return { isOk: true, lines: [`ok: ${shown} leaves hooks on and lists the store root`] };
}
