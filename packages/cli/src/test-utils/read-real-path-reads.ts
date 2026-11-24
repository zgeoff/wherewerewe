import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

// The one test that builds a PATH of the host's own folders: it installs the packed program.
const exemptFiles: ReadonlySet<string> = new Set(['e2e/build-packed-install.test.ts']);

// Every `file:line` of a test file under src and e2e that reads the real PATH, as `process.env.PATH`
// or any use of `process.env` as a whole, or that sets a PATH from an absolute folder: a string in
// its value, or a variable or helper that holds one.
export function readRealPathReads(packageDir: string): string[] {
  return listTypeScriptFiles(packageDir, ['src', 'e2e'])
    .filter((file) => file.endsWith('.test.ts') && !exemptFiles.has(file))
    .flatMap((file) => collectPathLines(file, readFileSync(join(packageDir, file), 'utf8')));
}

function collectPathLines(file: string, source: string): string[] {
  const tokens = parseSourceTokens(source);
  const hostNames = collectHostNames(tokens);

  const lines = tokens.flatMap((token, at) => {
    const isRead = token.kind === 'word' && token.value === 'process' && isEnvRead(tokens, at + 1);

    const isHostFolder =
      (token.kind === 'word' || token.kind === 'string') &&
      token.value === 'PATH' &&
      hasHostValue(tokens, findValueStart(tokens, at), hostNames);

    return isRead || isHostFolder ? [`${file}:${String(token.line)}`] : [];
  });

  return [...new Set(lines)];
}

// The names that a string of an absolute folder reaches: a variable whose value holds one, a
// function whose body holds one, and each name whose definition uses a name already found.
function collectHostNames(tokens: readonly SourceToken[]): ReadonlySet<string> {
  const definitions = collectDefinitions(tokens);

  const names = new Set<string>();

  let isGrowing = true;

  while (isGrowing) {
    isGrowing = false;

    for (const definition of definitions) {
      if (
        !names.has(definition.name) &&
        hasHostValue(tokens, definition.start, names, definition.end)
      ) {
        names.add(definition.name);

        isGrowing = true;
      }
    }
  }

  return names;
}

interface Definition {
  readonly name: string;
  readonly start: number;
  readonly end: number;
}

// Each `const|let|var name = value` up to its semicolon, and each `function name(...) { body }`.
function collectDefinitions(tokens: readonly SourceToken[]): Definition[] {
  const definitions: Definition[] = [];

  for (const [at, token] of tokens.entries()) {
    const name = tokens.at(at + 1);

    if (
      token.kind === 'word' &&
      ['const', 'let', 'var'].includes(token.value) &&
      name?.kind === 'word' &&
      tokens.at(at + 2)?.value === '='
    ) {
      definitions.push({ name: name.value, start: at + 3, end: getStatementEnd(tokens, at + 3) });
    }

    if (token.kind === 'word' && token.value === 'function' && name?.kind === 'word') {
      const open = tokens.findIndex((candidate, index) => index > at && candidate.value === '{');

      definitions.push({ name: name.value, start: open, end: getClose(tokens, open) });
    }
  }

  return definitions;
}

// The index of the semicolon that ends the statement from the index, at its own depth.
function getStatementEnd(tokens: readonly SourceToken[], from: number): number {
  let depth = 0;

  for (let at = from; at < tokens.length; at += 1) {
    const token = tokens.at(at);

    if (token?.kind === 'punct' && '([{'.includes(token.value)) {
      depth += 1;
    } else if (token?.kind === 'punct' && ')]}'.includes(token.value)) {
      depth -= 1;
    }

    if (depth < 0 || (depth === 0 && token?.value === ';')) {
      return at;
    }
  }

  return tokens.length;
}

// The index of the closing brace that matches the brace at the index.
function getClose(tokens: readonly SourceToken[], open: number): number {
  let depth = 0;

  for (let at = open; at < tokens.length; at += 1) {
    const token = tokens.at(at);

    if (token?.kind === 'punct' && token.value === '{') {
      depth += 1;
    } else if (token?.kind === 'punct' && token.value === '}') {
      depth -= 1;

      if (depth === 0) {
        return at;
      }
    }
  }

  return tokens.length;
}

// Whether the value that starts at the index, up to its comma, its closing bracket or the given
// end, holds a string that starts with a slash, or a name that reaches one.
function hasHostValue(
  tokens: readonly SourceToken[],
  from: number | null,
  hostNames: ReadonlySet<string>,
  end: number = tokens.length,
): boolean {
  if (from === null) {
    return false;
  }

  let depth = 0;

  for (let at = from; at < end; at += 1) {
    const token = tokens.at(at);

    if (token?.kind === 'punct' && '([{'.includes(token.value)) {
      depth += 1;
    } else if (token?.kind === 'punct' && ')]}'.includes(token.value)) {
      depth -= 1;
    }

    const isEnd =
      depth < 0 || (depth === 0 && token?.kind === 'punct' && [',', ';'].includes(token.value));

    if (isEnd && end === tokens.length) {
      return false;
    }

    if (token?.kind === 'string' && token.value.startsWith('/')) {
      return true;
    }

    if (token?.kind === 'word' && hostNames.has(token.value) && tokens.at(at - 1)?.value !== '.') {
      return true;
    }
  }

  return false;
}

// Whether `process.env` that starts at the index reads PATH, or is used as a whole object: a
// property other than PATH is the only use that holds no PATH.
function isEnvRead(tokens: readonly SourceToken[], from: number): boolean {
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

  return names[0] === 'env' && (names[1] === 'PATH' || names.length === 1);
}

// The index where the value of a `PATH` key or assignment starts, or null when the token is neither.
function findValueStart(tokens: readonly SourceToken[], at: number): number | null {
  if (tokens.at(at + 1)?.value === ':') {
    return at + 2;
  }

  const isMember = tokens.at(at - 1)?.value === '.' || tokens.at(at - 1)?.value === '[';
  const close = tokens.at(at + 1)?.value === ']' ? at + 2 : at + 1;
  const isAssigned = tokens.at(close)?.value === '=' && tokens.at(close + 1)?.value !== '=';

  return isMember && isAssigned ? close + 1 : null;
}
