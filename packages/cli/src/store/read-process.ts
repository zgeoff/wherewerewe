import { readFileSync } from 'node:fs';
import { isErrorCode } from './is-error-code.ts';
import type { ProcessState } from './types.ts';

// A pid outside the OS's range names no process, and a signal to 0 or past it would reach another.
const maxPID = 2 ** 31 - 1;

// The start time in /proc/<pid>/stat tells a process from a later one that got its pid. Where the
// stat file cannot be read, a signal 0 still tells whether any process has the pid.
export function readProcess(pid: number): ProcessState {
  if (!Number.isInteger(pid) || pid < 1 || pid > maxPID) {
    return { kind: 'gone' };
  }

  const stat = readStatFile(pid);

  if (stat === null) {
    return probeSignal(pid) ? { kind: 'running', start: null } : { kind: 'gone' };
  }

  // The fields after the name, which sits in parentheses, start at field 3, the state.
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

  return fields[0] === 'Z' ? { kind: 'gone' } : { kind: 'running', start: fields[19] ?? null };
}

// Null for any failure: a missing /proc, a hardened one that refuses the read, or a gone process.
function readStatFile(pid: number): string | null {
  try {
    return readFileSync(`/proc/${String(pid)}/stat`, 'utf8');
  } catch {
    return null;
  }
}

// EPERM means a process of another user has the pid.
function probeSignal(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return !isErrorCode(error, 'ESRCH');
  }
}
