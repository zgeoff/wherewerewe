import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const exemptFiles: ReadonlySet<string> = new Set([
  'src/cli.ts',
  'src/test-utils/read-process-env-reads.ts',
  'src/test-utils/read-process-env-reads.test.ts',
]);

const agentVariables = ['CLAUDE_CODE_SESSION_ID', 'CODEX_SESSION_ID', 'CODEX_THREAD_ID'];

// Every `file:line` under src and e2e that reads process.env, except the program's one entry, a
// copy of PATH into an explicit env object, and the lock folder an e2e parent hands its child. A
// read of the real environment makes a test pass on one machine and fail on another.
export function readProcessEnvReads(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['src', 'e2e'])
    .filter((file) => !exemptFiles.has(file))
    .flatMap((file) =>
      readFileSync(join(packageDir, file), 'utf8')
        .split('\n')
        .flatMap((line, index) => (isEnvRead(file, line) ? [`${file}:${String(index + 1)}`] : [])),
    );
}

// Every `file: VARIABLE` of an e2e test that runs www and does not name an agent variable: the
// process helper spreads process.env under the env it is given, so an unset one leaks in.
export function readUnsetAgentVariables(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['e2e']).flatMap((file) => {
    const text = readFileSync(join(packageDir, file), 'utf8');

    return text.includes("resolveProgram('www')")
      ? agentVariables
          .filter((variable) => !text.includes(variable))
          .map((variable) => `${file}: ${variable}`)
      : [];
  });
}

function listTypeScriptFiles(packageDir: string, folders: readonly string[]): string[] {
  return folders.flatMap((folder) =>
    readdirSync(join(packageDir, folder), { recursive: true })
      .map(String)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(folder, name)),
  );
}

function isEnvRead(file: string, line: string): boolean {
  const isPathCopy = /process\.env\[['"]PATH['"]\]/u.test(line);

  const isLockFolder =
    file === 'e2e/cli-stale-lock-takeover.test.ts' && line.includes('process.env.LOCK_FOLDER');

  return line.includes('process.env') && !isPathCopy && !isLockFolder;
}
