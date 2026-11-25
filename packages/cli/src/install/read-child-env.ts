import { readProbeEnv } from '../checks/read-probe-env.ts';
import { readProbePath } from '../checks/read-probe-path.ts';

// The env doctor hands `codex` and `gh`: a probe's env, which drops loader and wrapper settings and
// keeps the safe PATH, plus CODEX_HOME, where Codex keeps the rules it checks.
export function readChildEnv(
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): Record<string, string> {
  const codexHome = env['CODEX_HOME'];

  return {
    ...readProbeEnv(env, readProbePath(env['PATH'] ?? '', cwd), cwd),
    ...(codexHome === undefined ? {} : { CODEX_HOME: codexHome }),
  };
}
