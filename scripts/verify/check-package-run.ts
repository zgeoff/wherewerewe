import { WringerError } from '@wringer/core';
import type { ProcessOutput } from './read-www-output.ts';

// Checks a finished run of the installed binary: it fails the step with `check-failed` when the
// binary exited other than 0, printed nothing on stdout or anything on stderr, or printed a first line
// that is not exactly the text the journey names.
export function checkPackageRun(
  label: string,
  result: ProcessOutput,
  expected: string,
): ProcessOutput {
  const firstLine = result.stdout.split('\n')[0] ?? '';

  if (
    result.exitCode !== 0 ||
    result.stdout === '' ||
    result.stderr !== '' ||
    firstLine !== expected
  ) {
    throw new WringerError('check-failed', {
      message: `${label} exited ${String(result.exitCode)} and printed ${JSON.stringify(result.stdout + result.stderr)}, whose first line is not ${JSON.stringify(expected)}`,
    });
  }

  return result;
}
