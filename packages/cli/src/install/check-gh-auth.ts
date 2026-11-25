import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks that `gh` is signed in, since the checks read pull requests through it. It prints none of
// what `gh auth status` says. `gh` is the program found on a safe PATH, or `null`.
export function checkGhAuth(
  gh: string | null,
  env: Readonly<Record<string, string | undefined>>,
): DoctorCheck {
  if (gh === null) {
    return buildFailedCheck([
      'www doctor: gh is not on PATH, so no check reads a pull request.',
      'Run: brew install gh',
    ]);
  }

  if (!probeSignedIn(gh, env)) {
    return buildFailedCheck(['www doctor: gh is not signed in.', 'Run: gh auth login']);
  }

  return { isOk: true, lines: ['ok: gh is signed in'] };
}

function probeSignedIn(gh: string, env: Readonly<Record<string, string | undefined>>): boolean {
  try {
    const result = Bun.spawnSync([gh, 'auth', 'status'], {
      env: { ...env, GH_PROMPT_DISABLED: '1' },
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 10_000,
    });

    return result.exitCode === 0;
  } catch {
    return false;
  }
}
