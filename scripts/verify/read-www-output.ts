import { WringerError } from '@wringer/core';

export interface ProcessOutput {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export interface WWWOutput {
  readonly exitCode: number;
  readonly firstLine: string;
}

// Turns a finished `www` process into the data a journey compares, and fails the step with
// `check-failed` when `www` exited other than 0.
export function readWWWOutput(command: string, output: ProcessOutput): WWWOutput {
  if (output.exitCode !== 0) {
    throw new WringerError('check-failed', {
      message: `www ${command} exited ${String(output.exitCode)}: ${output.stderr.trim()}`,
    });
  }

  return { exitCode: output.exitCode, firstLine: output.stdout.split('\n')[0] ?? '' };
}
