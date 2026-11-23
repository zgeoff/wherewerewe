#!/usr/bin/env bun
import { runCLI } from './run-cli.ts';

const result = await runCLI({
  argv: process.argv.slice(2),
  env: process.env,
  cwd: process.cwd(),
  now: Date.now,
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

process.exitCode = result.exitCode;
