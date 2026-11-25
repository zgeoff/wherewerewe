#!/usr/bin/env -S bun --no-env-file --config=/dev/null
import manifest from '../package.json' with { type: 'json' };
import { readBinaryPath } from './install/read-binary-path.ts';
import { runCLI } from './run-cli.ts';

const argv = process.argv.slice(2);

const result = await runCLI({
  argv,
  env: process.env,
  now: Date.now,
  stdin: argv[0] === 'hook' ? await Bun.stdin.text() : '',
  binaryPath: readBinaryPath(process.env, process.execPath),
  version: manifest.version,
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

process.exitCode = result.exitCode;
