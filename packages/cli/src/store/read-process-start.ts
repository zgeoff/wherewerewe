import { readFileSync } from 'node:fs';
import { isErrorCode } from './is-error-code.ts';

// The start time in /proc/<pid>/stat tells a process from a later one that got its pid. Null when
// the process is gone or a zombie, or the system has no /proc.
export function readProcessStart(pid: number): string | null {
  const stat = readStatFile(pid);

  if (stat === null) {
    return null;
  }

  // The fields after the name, which sits in parentheses, start at field 3, the state.
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');

  return fields[0] === 'Z' ? null : (fields[19] ?? null);
}

function readStatFile(pid: number): string | null {
  try {
    return readFileSync(`/proc/${String(pid)}/stat`, 'utf8');
  } catch (error) {
    if (isErrorCode(error, 'ENOENT')) {
      return null;
    }

    throw error;
  }
}
