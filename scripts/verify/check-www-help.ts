import { WringerError } from '@wringer/core';
import { readWWWOutput } from './read-www-output.ts';
import type { ProcessOutput, WWWOutput } from './read-www-output.ts';

// Checks a finished `www help` process: it fails the step with `check-failed` when `www` exited
// other than 0, or printed a first line other than the one the journey names.
export function checkWWWHelp(result: ProcessOutput, firstLine: string): WWWOutput {
  const output = readWWWOutput('help', result);

  if (output.firstLine !== firstLine) {
    throw new WringerError('check-failed', {
      message: `www help printed ${JSON.stringify(output.firstLine)} as its first line, not ${JSON.stringify(firstLine)}`,
    });
  }

  return output;
}
