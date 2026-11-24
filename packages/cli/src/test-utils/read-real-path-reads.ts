import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

// The one test that builds a PATH of the host's own folders: it installs the packed program.
const exemptFiles: ReadonlySet<string> = new Set(['e2e/build-packed-install.test.ts']);

// Every `file:line` of a test file under src and e2e that reads the real PATH, as `process.env.PATH`
// or `process.env['PATH']`, or that sets a `PATH` key from a string of an absolute folder. A test's
// PATH holds only folders the test makes, so no probe finds the host's own gh or git.
export function readRealPathReads(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['src', 'e2e'])
    .filter((file) => file.endsWith('.test.ts') && !exemptFiles.has(file))
    .flatMap((file) => collectPathLines(file, readFileSync(join(packageDir, file), 'utf8')));
}

function collectPathLines(file: string, source: string): string[] {
  const tokens = parseSourceTokens(source);

  const lines = tokens.flatMap((token, at) => {
    const isRead = token.kind === 'word' && token.value === 'process' && isPathRead(tokens, at + 1);

    const isHostFolder =
      (token.kind === 'word' || token.kind === 'string') &&
      token.value === 'PATH' &&
      tokens.at(at + 1)?.value === ':' &&
      hasAbsoluteFolder(tokens, at + 2);

    return isRead || isHostFolder ? [`${file}:${String(token.line)}`] : [];
  });

  return [...new Set(lines)];
}

// `.env.PATH`, `?.env?.PATH`, `.env['PATH']` and the same with `["PATH"]` after `process`.
function isPathRead(tokens: readonly SourceToken[], from: number): boolean {
  const names: string[] = [];

  for (let at = from; at < from + 12 && names.length < 2; at += 1) {
    const token = tokens.at(at);

    if (token?.kind === 'punct' && '.?[]'.includes(token.value)) {
      continue;
    }

    if (token?.kind === 'word' || token?.kind === 'string') {
      names.push(token.value);
    } else {
      break;
    }
  }

  return names[0] === 'env' && names[1] === 'PATH';
}

// Whether the value that starts at the index, up to its comma or closing brace, holds a string
// that starts with a slash.
function hasAbsoluteFolder(tokens: readonly SourceToken[], from: number): boolean {
  let depth = 0;

  for (let at = from; at < tokens.length; at += 1) {
    const token = tokens.at(at);

    if (token?.kind === 'punct' && '([{'.includes(token.value)) {
      depth += 1;
    } else if (token?.kind === 'punct' && ')]}'.includes(token.value)) {
      depth -= 1;
    }

    if (depth < 0 || (depth === 0 && token?.kind === 'punct' && token.value === ',')) {
      return false;
    }

    if (token?.kind === 'string' && token.value.startsWith('/')) {
      return true;
    }
  }

  return false;
}
