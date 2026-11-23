import { isErrorCode } from './is-error-code.ts';

// A signal 0 checks the process without touching it; EPERM means it runs under another user.
export function probeProcess(pid: number): boolean {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return !isErrorCode(error, 'ESRCH');
  }
}
