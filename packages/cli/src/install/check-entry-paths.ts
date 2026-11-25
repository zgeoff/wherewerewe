import { accessSync, closeSync, constants, openSync, readSync } from 'node:fs';
import { buildFailedCheck } from './build-failed-check.ts';
import type { DoctorCheck } from './types.ts';

// Checks each path that a hook entry runs: it exists, it is executable, it is the path that
// `command -v wherewerewe` prints now, and it is not a script that needs its interpreter on the
// hook's PATH. `bin` is that path, or `null` when no wherewerewe is on the PATH.
export function checkEntryPaths(paths: readonly string[], bin: string | null): DoctorCheck {
  const problems = [...new Set(paths)].flatMap((path) => describePath(path, bin));

  if (problems.length > 0) {
    return buildFailedCheck([...problems, 'Run: www install']);
  }

  return {
    isOk: true,
    lines: [`ok: ${String(new Set(paths).size)} hook entry path is the one on PATH`],
  };
}

function describePath(path: string, bin: string | null): string[] {
  if (!readIsExecutable(path)) {
    return [`www doctor: the hooks run ${path}, which is missing or not executable.`];
  }

  if (readIsScript(path)) {
    return [
      `www doctor: the hooks run ${path}, a script that needs its interpreter on the hook's PATH.`,
    ];
  }

  return bin !== null && bin !== path
    ? [`www doctor: the hooks run ${path}, but the wherewerewe first on PATH is ${bin}.`]
    : [];
}

function readIsExecutable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);

    return true;
  } catch {
    return false;
  }
}

function readIsScript(path: string): boolean {
  const handle = openSync(path, 'r');

  try {
    const head = Buffer.alloc(2);

    readSync(handle, head, 0, 2, 0);

    return head.toString('latin1') === '#!';
  } finally {
    closeSync(handle);
  }
}
