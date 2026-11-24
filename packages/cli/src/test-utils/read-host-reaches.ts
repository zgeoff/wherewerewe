import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listTypeScriptFiles } from './list-type-script-files.ts';
import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

const skippedFolders: ReadonlySet<string> = new Set(['node_modules', '.git', '.worktrees']);

// Every `file:line` of a test file anywhere in the repo that runs gh or git by an absolute path,
// runs a git command that reaches a remote, or opens a socket or an HTTP call. An exemption covers
// one kind of reach in one file, and a URL in a git call is never exempt.
export function readHostReaches(rootDir: string): string[] {
  const folders = readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !skippedFolders.has(entry.name))
    .map((entry) => entry.name);

  const rootFiles = readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => entry.name);

  return [...rootFiles, ...listTypeScriptFiles(rootDir, folders)]
    .filter((file) => file.endsWith('.test.ts') && !file.split('/').includes('node_modules'))
    .flatMap((file) => collectReachLines(file, readFileSync(join(rootDir, file), 'utf8')));
}

type ReachKind =
  | 'absolute-run'
  | 'remote-git'
  | 'remote-git-runner'
  | 'remote-url'
  | 'network-import'
  | 'fetch'
  | 'socket';

interface Exemption {
  readonly file: string;
  readonly kind: ReachKind;
  readonly why: string;
}

// A remote verb in a call to `runGit` reaches no network when its repo and remote sit under the
// test's temp folder, which each exemption below says.
const exemptions: readonly Exemption[] = [
  {
    file: 'scripts/verify/run-www-line-on-copy.test.ts',
    kind: 'network-import',
    why: 'it listens on a unix socket inside its own temp folder, which no network reaches',
  },
  {
    file: 'packages/cli/src/checks/probe-branch.test.ts',
    kind: 'remote-git-runner',
    why: 'it pushes main to the bare repo that seedGitRepo makes under its own temp folder',
  },
  {
    file: 'packages/cli/src/checks/run-command.test.ts',
    kind: 'remote-git-runner',
    why: 'it clones the bare repo that seedGitRepo makes under its own temp folder, by a file URL',
  },
];

function collectReachLines(file: string, source: string): string[] {
  const tokens = parseSourceTokens(source);

  const exempt = new Set(
    exemptions.filter((entry) => entry.file === file).map((entry) => entry.kind),
  );

  const lines = tokens.flatMap((token, at) => {
    const kind = findReachKind(tokens, at);

    return kind === null || exempt.has(kind) ? [] : [`${file}:${String(token.line)}`];
  });

  return [...new Set(lines)];
}

function findReachKind(tokens: readonly SourceToken[], at: number): ReachKind | null {
  const token = tokens.at(at);

  if (token?.kind === 'string') {
    return findStringReachKind(tokens, at, token.value);
  }

  if (token?.kind !== 'word') {
    return null;
  }

  if (isFetchCall(tokens, at)) {
    return 'fetch';
  }

  return isBunSocketCall(tokens, at) || isSocketConstruction(tokens, at) ? 'socket' : null;
}

// The start of a shell command inside a string: the string's start, a line start, or after `;`,
// `&&` or `|`.
const commandStart = String.raw`(?:^|\n\s*|&&\s*|;\s*|\|\s*)`;

// A shell command's own environment words, as in `GIT_DIR=x git fetch`, may come before it.
const commandWords = String.raw`(?:\w+=\S*\s+)*(?:(?:exec|env)\s+)?`;

const remoteVerbs: ReadonlySet<string> = new Set(['clone', 'fetch', 'pull', 'push', 'ls-remote']);

// The options git takes before its subcommand: `-C path`, `-c key=value`, `--git-dir path`, or any
// other option.
const gitOptions = String.raw`(?:(?:-[Cc]\s+\S+|--(?:git-dir|work-tree|namespace|exec-path)\s+\S+|-\S+)\s+)*`;

const remoteGitRun = new RegExp(
  String.raw`${commandStart}${commandWords}(?:\S*/)?git\s+${gitOptions}(?:${[...remoteVerbs].join('|')})(?:\s|$)`,
  'u',
);

function findStringReachKind(
  tokens: readonly SourceToken[],
  at: number,
  value: string,
): ReachKind | null {
  if (isAbsoluteRun(tokens, at)) {
    return 'absolute-run';
  }

  if (remoteGitRun.test(value) || (value === 'git' && isRemoteGitArgv(tokens, at))) {
    return 'remote-git';
  }

  if (isNetworkImport(tokens, at)) {
    return 'network-import';
  }

  if (isRemoteUrlInGitCall(tokens, at)) {
    return 'remote-url';
  }

  return isRemoteVerbInGitCall(tokens, at) ? 'remote-git-runner' : null;
}

const absoluteRun = new RegExp(
  String.raw`${commandStart}${commandWords}"?/(?:[^\s/"]+/)*(?:gh|git)"?(?:\s|$)`,
  'u',
);

// A string that runs gh or git by an absolute path: a shell line, or a bare path that opens a call's
// argument or its argv array, as `run(['/usr/bin/git', 'status'])` or `Bun.spawn({ cmd: [...] })`.
// A bare path elsewhere, such as one item of a list, is data.
function isAbsoluteRun(tokens: readonly SourceToken[], at: number): boolean {
  const value = tokens.at(at)?.value ?? '';

  if (!absoluteRun.test(value)) {
    return false;
  }

  const before = tokens.at(at - 1)?.value;
  const beforeArray = tokens.at(at - 2)?.value;

  const isArgvStart =
    before === '(' ||
    (before === '[' && beforeArray === '(') ||
    (before === '[' && beforeArray === ':' && tokens.at(at - 3)?.value === 'cmd');

  return /\s/u.test(value) || isArgvStart;
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

const networkModules: ReadonlySet<string> = new Set([
  'net',
  'http',
  'https',
  'http2',
  'tls',
  'dgram',
]);

// An import or require of a socket or HTTP module, as `node:net` or, after `from`, `import`,
// `import(` or `require(`, as `net`.
function isNetworkImport(tokens: readonly SourceToken[], at: number): boolean {
  const value = tokens.at(at)?.value ?? '';

  if (value.startsWith('node:')) {
    return networkModules.has(value.slice('node:'.length));
  }

  const before = tokens.at(at - 1);

  const isImportPosition =
    before?.value === 'from' ||
    before?.value === 'import' ||
    (before?.value === '(' && ['import', 'require'].includes(tokens.at(at - 2)?.value ?? ''));

  return isImportPosition && networkModules.has(value);
}

const remoteUrl = /^(?:(?:https?|ssh|git|ftp):\/\/|git@|[\w.-]+@[\w.-]+:)/u;

// A URL of a remote among the strings of a git runner's call, `file://` aside.
function isRemoteUrlInGitCall(tokens: readonly SourceToken[], at: number): boolean {
  return remoteUrl.test(tokens.at(at)?.value ?? '') && findGitCall(tokens, at) !== null;
}

// Whether the string sits in a call to a git runner, as `runGit(folder, env, [...])`: a function
// whose name holds `git`, which is no `Bun.spawn` of the word `git` that the argv check reads.
function findGitCall(tokens: readonly SourceToken[], at: number): number | null {
  let from = at;

  for (let hops = 0; hops < 3; hops += 1) {
    const open = findOpeningParen(tokens, from);
    const callee = open === null ? undefined : tokens.at(open - 1);

    if (callee?.kind === 'word' && /git/iu.test(callee.value)) {
      return open;
    }

    if (open === null) {
      return null;
    }

    from = open;
  }

  return null;
}

// The index of the parenthesis that opens the call whose arguments hold the token, however deep in
// an array or an object of them, or -1.
function findOpeningParen(tokens: readonly SourceToken[], at: number): number | null {
  let depth = 0;

  for (let index = at - 1; index >= 0; index -= 1) {
    const value = tokens.at(index)?.kind === 'punct' ? tokens.at(index)?.value : undefined;

    if (value !== undefined && ')]}'.includes(value)) {
      depth += 1;
    } else if (value !== undefined && '([{'.includes(value)) {
      if (depth > 0) {
        depth -= 1;
      } else if (value === '(') {
        return index;
      }
    }
  }

  return null;
}

// A remote verb that opens the argv array of a git runner's call, after any options:
// `runGit(folder, env, ['fetch', 'origin'])`.
function isRemoteVerbInGitCall(tokens: readonly SourceToken[], at: number): boolean {
  if (!remoteVerbs.has(tokens.at(at)?.value ?? '')) {
    return false;
  }

  let index = at - 1;

  while (index >= 0 && tokens.at(index)?.value !== '[') {
    const before = tokens.at(index);

    if (before?.kind !== 'string' && before?.value !== ',') {
      return false;
    }

    index -= 1;
  }

  return index >= 0 && findGitCall(tokens, index) !== null;
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

// `new WebSocket(`, `new EventSource(` or `new XMLHttpRequest(`.
function isSocketConstruction(tokens: readonly SourceToken[], at: number): boolean {
  return (
    ['WebSocket', 'EventSource', 'XMLHttpRequest'].includes(tokens.at(at)?.value ?? '') &&
    tokens.at(at - 1)?.value === 'new'
  );
}
