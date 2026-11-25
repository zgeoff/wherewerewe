#!/usr/bin/env -S bun --no-env-file --config=/dev/null
import { realpathSync } from 'node:fs';
import { isatty } from 'node:tty';
import { runCLI } from './run-cli.ts';

const argv = process.argv.slice(2);

const result = await runCLI({
  argv,
  env: process.env,
  cwd: process.cwd(),
  now: Date.now,
  terminal: { stdin: isatty(0), stdout: isatty(1) },
  stdin: argv[0] === 'hook' ? await Bun.stdin.text() : undefined,
  emit: (text) => {
    process.stdout.write(text);
  },
  binaryPath: { execPath: process.execPath, realPath: realpathSync(process.execPath) },
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

process.exitCode = result.exitCode;
