import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

// The one test that listens on a unix socket inside its own temp folder, which no network reaches.
const exemptFiles: ReadonlySet<string> = new Set(['scripts/verify/run-www-line-on-copy.test.ts']);

// Every `file:line` of a test file that runs gh or git by an absolute path, runs a git command that
// reaches a remote, or opens a socket or an HTTP call. A call to `runGit` from `@zgeoff/testing/git`
// on a repo under the test's temp folder is no remote reach.
export function readHostReaches(rootDir: string): string[] {
  return listTypeScriptFiles(rootDir, ['packages', 'scripts'])
    .filter(
      (file) =>
        file.endsWith('.test.ts') &&
        !file.split('/').includes('node_modules') &&
        !exemptFiles.has(file),
    )
    .flatMap((file) => collectReachLines(file, readFileSync(join(rootDir, file), 'utf8')));
}

function collectReachLines(file: string, source: string): string[] {
  const tokens = parseSourceTokens(source);

  const lines = tokens.flatMap((token, at) =>
    isHostReach(tokens, at) ? [`${file}:${String(token.line)}`] : [],
  );

  return [...new Set(lines)];
}

const remoteVerbs: ReadonlySet<string> = new Set(['clone', 'fetch', 'pull', 'push', 'ls-remote']);

// The start of a shell command inside a string: the string's start, a line start, or after `;`,
// `&&` or `|`, with an optional `exec`.
const commandStart = String.raw`(?:^|\n\s*|&&\s*|;\s*|\|\s*)(?:exec\s+)?`;

const remoteGitRun = new RegExp(
  String.raw`${commandStart}(?:\S*/)?git\s+(?:(?:-C\s+\S+|-\S+)\s+)*(?:${[...remoteVerbs].join('|')})(?:\s|$)`,
  'u',
);

function isHostReach(tokens: readonly SourceToken[], at: number): boolean {
  const token = tokens.at(at);

  if (token?.kind === 'string') {
    return (
      isAbsoluteRun(tokens, at) ||
      remoteGitRun.test(token.value) ||
      isNetworkImport(tokens, at) ||
      (token.value === 'git' && isRemoteGitArgv(tokens, at))
    );
  }

  return token?.kind === 'word' && (isFetchCall(tokens, at) || isBunSocketCall(tokens, at));
}

const absoluteRun = new RegExp(
  String.raw`${commandStart}"?/(?:[^\s/"]+/)*(?:gh|git)"?(?:\s|$)`,
  'u',
);

// A string that runs gh or git by an absolute path: a shell line, or a bare path that opens a call's
// argument or its argv array, as `run(['/usr/bin/git', 'status'])`. A bare path elsewhere, such as
// one item of a list, is data.
function isAbsoluteRun(tokens: readonly SourceToken[], at: number): boolean {
  const value = tokens.at(at)?.value ?? '';

  if (!absoluteRun.test(value)) {
    return false;
  }

  const before = tokens.at(at - 1)?.value;
  const isArgvStart = before === '(' || (before === '[' && tokens.at(at - 2)?.value === '(');

  return /\s/u.test(value) || isArgvStart;
}

const networkModules: ReadonlySet<string> = new Set([
  'net',
  'http',
  'https',
  'http2',
  'tls',
  'dgram',
]);

// An import or require of a socket or HTTP module, as `node:net` or, after `from`, `import(` or
// `require(`, as `net`.
function isNetworkImport(tokens: readonly SourceToken[], at: number): boolean {
  const value = tokens.at(at)?.value ?? '';

  if (value.startsWith('node:')) {
    return networkModules.has(value.slice('node:'.length));
  }

  const before = tokens.at(at - 1);

  const isImportPosition =
    before?.value === 'from' ||
    (before?.value === '(' && ['import', 'require'].includes(tokens.at(at - 2)?.value ?? ''));

  return isImportPosition && networkModules.has(value);
}

// Whether the `'git'` string at the index starts an argv whose subcommand is a remote verb. The
// subcommand is the first string at the argv's own depth that is no option; `-C` and `-c` take the
// token after them.
function isRemoteGitArgv(tokens: readonly SourceToken[], at: number): boolean {
  let depth = 0;
  let skip = false;

  for (let index = at + 1; index < tokens.length; index += 1) {
    const token = tokens.at(index);

    if (token?.kind === 'punct' && '([{'.includes(token.value)) {
      depth += 1;
    } else if (token?.kind === 'punct' && ')]}'.includes(token.value)) {
      depth -= 1;
    }

    if (depth < 0 || (depth === 0 && token?.value === ';')) {
      return false;
    }

    if (depth === 0 && skip) {
      skip = token?.kind === 'punct';
    } else if (depth === 0 && token?.kind === 'string') {
      if (token.value === '-C' || token.value === '-c') {
        skip = true;
      } else if (!token.value.startsWith('-')) {
        return remoteVerbs.has(token.value);
      }
    }
  }

  return false;
}

// A `fetch(` call, bare or on `globalThis`, but not a method of another object.
function isFetchCall(tokens: readonly SourceToken[], at: number): boolean {
  if (tokens.at(at)?.value !== 'fetch' || tokens.at(at + 1)?.value !== '(') {
    return false;
  }

  return tokens.at(at - 1)?.value !== '.' || tokens.at(at - 2)?.value === 'globalThis';
}

const bunSocketCalls: ReadonlySet<string> = new Set(['serve', 'listen', 'connect', 'udpSocket']);

function isBunSocketCall(tokens: readonly SourceToken[], at: number): boolean {
  const call = tokens.at(at + 2)?.value ?? '';

  return (
    tokens.at(at)?.value === 'Bun' && tokens.at(at + 1)?.value === '.' && bunSocketCalls.has(call)
  );
}
