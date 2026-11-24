import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { stripComments } from './strip-comments.ts';

const exemptFiles: ReadonlySet<string> = new Set([
  'src/cli.ts',
  'src/test-utils/read-process-env-reads.ts',
  'src/test-utils/read-process-env-reads.test.ts',
]);

// Every `file:line` under src and e2e that reads process.env, except the program's one entry, a
// copy of PATH into an explicit env object, and the lock folder an e2e parent hands its child.
// A comment reads nothing, and a PATH copy exempts only its own expression, not its line.
export function readProcessEnvReads(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['src', 'e2e'])
    .filter((file) => !exemptFiles.has(file))
    .flatMap((file) =>
      stripComments(readFileSync(join(packageDir, file), 'utf8'))
        .split('\n')
        .flatMap((line, index) => (isEnvRead(file, line) ? [`${file}:${String(index + 1)}`] : [])),
    );
}

const pathCopy = /process\.env\[['"]PATH['"]\](?:\s*\?\?\s*(?:''|""))?/gu;

function isEnvRead(file: string, line: string): boolean {
  const isLockFolder =
    file === 'e2e/cli-stale-lock-takeover.test.ts' && line.includes('process.env.LOCK_FOLDER');

  return line.replaceAll(pathCopy, '').includes('process.env') && !isLockFolder;
}
