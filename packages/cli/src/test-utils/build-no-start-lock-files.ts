import type { LockFiles } from '../store/types.ts';

// Wraps the lock's calls so no process read shows a start time, as on a system with no /proc, or
// with one that refuses the read. A gone process still reads as gone, as a signal 0 shows it.
export function buildNoStartLockFiles(files: LockFiles): LockFiles {
  return {
    ...files,
    readProcess: (pid) => {
      const state = files.readProcess(pid);

      return state.kind === 'gone' ? state : { kind: 'running', start: null };
    },
  };
}
