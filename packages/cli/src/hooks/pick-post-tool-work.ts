import { isSessionName } from '../rules/is-session-name.ts';
import { collectSimpleCommands } from './collect-simple-commands.ts';
import { scanShellCommand } from './scan-shell-command.ts';
import { stripLineContinuations } from './strip-line-continuations.ts';
import type { Harness } from './types.ts';
import { unwrapShell } from './unwrap-shell.ts';

export interface PostToolWork {
  // the session a successful init, attach or import names, and the verb
  readonly bind: { readonly name: string; readonly verb: string } | null;

  // `<owner>/<repo>#<n>` of the first pull request address in the output of `gh pr create`
  readonly prRef: string | null;

  // the command is a push, a pull request create or a merge
  readonly isNudgeCommand: boolean;
}

// What the PostToolUse steps 1 to 3 look for in a successful command and its output, by lexical
// rules alone.
export function pickPostToolWork(
  command: string,
  response: string,
  harness: Harness,
): PostToolWork {
  const text = harness === 'codex' ? unwrapShell(command.trim()) : command;
  const commands = collectSimpleCommands(stripLineContinuations(text));
  const isPrCreate = commands.some((words) => isGhPullRequest(words, 'create'));
  const isPrMerge = commands.some((words) => isGhPullRequest(words, 'merge'));
  const isPush = commands.some((words) => isGitSubcommand(words, 'push'));

  return {
    bind: findBind(text),
    prRef: isPrCreate ? findPullRequestRef(response) : null,
    isNudgeCommand: isPrCreate || isPrMerge || isPush,
  };
}

const ghOptionsWithValue: ReadonlySet<string> = new Set(['-R', '--repo', '--hostname']);

// `gh pr <verb>`, run as a command: `gh`, any options and their values, then `pr` and the verb.
// A word after the verb, or a `pr` further on, is an argument and never the subcommand.
function isGhPullRequest(words: readonly string[], verb: string): boolean {
  if (findProgramName(words) !== 'gh') {
    return false;
  }

  let at = 1;

  while (words[at]?.startsWith('-') === true) {
    at += ghOptionsWithValue.has(words[at] ?? '') ? 2 : 1;
  }

  return words[at] === 'pr' && words[at + 1] === verb;
}

function findProgramName(words: readonly string[]): string | undefined {
  return words[0]?.split('/').at(-1);
}

const gitOptionsWithValue: ReadonlySet<string> = new Set(['-C', '-c', '--git-dir', '--work-tree']);

// `git <subcommand>`, run as a command, after any global options and their values.
function isGitSubcommand(words: readonly string[], subcommand: string): boolean {
  if (findProgramName(words) !== 'git') {
    return false;
  }

  let at = 1;

  while (words[at]?.startsWith('-') === true) {
    at += gitOptionsWithValue.has(words[at] ?? '') ? 2 : 1;
  }

  return words[at] === subcommand;
}

const bindVerbs: ReadonlySet<string> = new Set(['init', 'attach', 'import']);

function findBind(text: string): PostToolWork['bind'] {
  const first = scanShellCommand(stripLineContinuations(text))?.[0];
  const [program, verb, name] = first?.words ?? [];
  const base = program?.split('/').at(-1);

  if (
    (base !== 'www' && base !== 'wherewerewe') ||
    verb === undefined ||
    !bindVerbs.has(verb) ||
    name === undefined ||
    !isSessionName(name)
  ) {
    return null;
  }

  return { name, verb };
}

function findPullRequestRef(response: string): string | null {
  const found =
    /https:\/\/github\.com\/(?<owner>[A-Za-z0-9_.-]+)\/(?<repo>[A-Za-z0-9_.-]+)\/pull\/(?<number>[1-9][0-9]*)/u.exec(
      response,
    )?.groups;

  return found === undefined
    ? null
    : `${found['owner'] ?? ''}/${found['repo'] ?? ''}#${found['number'] ?? ''}`;
}
