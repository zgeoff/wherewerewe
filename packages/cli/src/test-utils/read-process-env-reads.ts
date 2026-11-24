import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

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

// A read is `process` followed by `.env`, `?.env` or `["env"]`, in any spacing and over any lines,
// and it reports the line of `process`. A name in a comment or a string reads nothing.
function collectEnvReadLines(file: string, source: string): string[] {
  const tokens = parseSourceTokens(source);

  const lines = tokens.flatMap((token, at) => {
    const access =
      token.kind === 'word' && token.value === 'process' ? findEnvAccess(tokens, at + 1) : null;

    return access === null || isExemptRead(file, access) ? [] : [`${file}:${String(token.line)}`];
  });

  return [...new Set(lines)];
}

interface EnvAccess {
  readonly dotName: string | undefined;
  readonly bracketName: string | undefined;
}

// What follows `process`: the access to its env and the name read from it, or null for no access.
function findEnvAccess(tokens: readonly SourceToken[], from: number): EnvAccess | null {
  const first = tokens.at(from);
  const isOptional = first?.value === '?' && tokens.at(from + 1)?.value === '.';
  const afterDot = isOptional ? from + 2 : from + 1;

  const isDotted =
    (first?.value === '.' || isOptional) &&
    tokens.at(afterDot)?.kind === 'word' &&
    tokens.at(afterDot)?.value === 'env';

  const isBracketed =
    first?.value === '[' &&
    tokens.at(from + 1)?.kind === 'string' &&
    tokens.at(from + 1)?.value === 'env' &&
    tokens.at(from + 2)?.value === ']';

  if (!isDotted && !isBracketed) {
    return null;
  }

  const rest = isDotted ? afterDot + 1 : from + 3;
  const named = tokens.at(rest);

  return {
    dotName:
      named?.value === '.' && tokens.at(rest + 1)?.kind === 'word'
        ? tokens.at(rest + 1)?.value
        : undefined,
    bracketName:
      named?.value === '[' && tokens.at(rest + 1)?.kind === 'string'
        ? tokens.at(rest + 1)?.value
        : undefined,
  };
}

function isExemptRead(file: string, access: EnvAccess): boolean {
  const isPathCopy = access.bracketName === 'PATH';

  const isLockFolder =
    file === 'e2e/cli-stale-lock-takeover.test.ts' && access.dotName === 'LOCK_FOLDER';

  return isPathCopy || isLockFolder;
}
