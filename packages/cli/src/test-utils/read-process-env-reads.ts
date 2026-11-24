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
// A comment reads nothing, and a PATH copy exempts only its own read, not its line.
export function readProcessEnvReads(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['src', 'e2e'])
    .filter((file) => !exemptFiles.has(file))
    .flatMap((file) => collectEnvReadLines(file, readFileSync(join(packageDir, file), 'utf8')));
}

// Each `process.env` becomes a marker that holds its source line before the transpiler cuts the
// comments, so the line survives the transpiler's reprint, and no name is inlined as a constant.
const marker = 'processEnvAtLine';
const envAccess = /process\s*(?:\.\s*env\b|\[\s*["'`]env["'`]\s*\])/gu;

const markedRead = new RegExp(
  `${marker}(?<line>\\d+)(?:\\.(?<dotName>\\w+)|\\["(?<bracketName>\\w+)"\\])?`,
  'gu',
);

function collectEnvReadLines(file: string, source: string): string[] {
  const marked = source
    .split('\n')
    .map((line, index) => line.replaceAll(envAccess, `${marker}${String(index + 1)}`))
    .join('\n');

  const lines = [...stripComments(marked).matchAll(markedRead)]
    .map((match) => match.groups ?? {})
    .filter((read) => !isExemptRead(file, read['dotName'], read['bracketName']))
    .map((read) => `${file}:${String(read['line'])}`);

  return [...new Set(lines)];
}

function isExemptRead(
  file: string,
  dotName: string | undefined,
  bracketName: string | undefined,
): boolean {
  const isPathCopy = bracketName === 'PATH';
  const isLockFolder = file === 'e2e/cli-stale-lock-takeover.test.ts' && dotName === 'LOCK_FOLDER';

  return isPathCopy || isLockFolder;
}
