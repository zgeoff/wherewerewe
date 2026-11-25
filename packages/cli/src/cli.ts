#!/usr/bin/env -S bun --no-env-file --config=/dev/null
import { isatty } from 'node:tty';
import { runCLI } from './run-cli.ts';

const result = await runCLI({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now: Date.now,
  terminal: { stdin: isatty(0), stdout: isatty(1) },
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

process.exitCode = result.exitCode;
