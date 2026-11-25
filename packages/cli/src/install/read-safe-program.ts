import { readProbePath, readProbeProgram } from '../checks/read-probe-path.ts';

// Finds a program on the PATH of `env` that a repo cannot have planted: it skips each entry that is
// empty, relative or under the working folder, and each program whose real path is. It runs nothing.
export function readSafeProgram(
  name: string,
  env: Readonly<Record<string, string | undefined>>,
  cwd: string,
): string | null {
  return readProbeProgram(name, readProbePath(env['PATH'] ?? '', cwd), cwd);
}
