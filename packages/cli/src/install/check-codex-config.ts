import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks `config.toml`: it does not turn hooks off (a missing `hooks` line passes, since hooks are
// on by default), and it lists the store root in `writable_roots`.
export function checkCodexConfig(
  text: string | null,
  shown: string,
  storeRoot: string,
): DoctorCheck {
  const config = text ?? '';

  const problems = [
    ...(/^\s*hooks\s*=\s*false\s*(?:#.*)?$/mu.test(featuresSection(config))
      ? [
          `www doctor: ${shown} turns hooks off with hooks = false.`,
          `Set hooks = true under [features] in ${shown}.`,
        ]
      : []),
    ...(config.includes(JSON.stringify(storeRoot)) && /^\s*writable_roots\s*=/mu.test(config)
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

function featuresSection(config: string): string {
  const start = /^\[features\]\s*$/mu.exec(config);

  if (start === null) {
    return '';
  }

  const rest = config.slice(start.index + start[0].length);
  const next = /^\[/mu.exec(rest);

  return next === null ? rest : rest.slice(0, next.index);
}
