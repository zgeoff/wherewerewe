import { isSessionName } from '../rules/is-session-name.ts';
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
  const isPrCreate = /(?:^|[\s;&|(])gh\s+pr\s+create(?:\s|$)/u.test(text);
  const isPrMerge = /(?:^|[\s;&|(])gh\s+pr\s+merge(?:\s|$)/u.test(text);
  const isPush = /(?:^|[\s;&|(])git(?:\s+-\S+(?:\s+\S+)?)*\s+push(?:\s|$)/u.test(text);

  return {
    bind: findBind(text),
    prRef: isPrCreate ? findPullRequestRef(response) : null,
    isNudgeCommand: isPrCreate || isPrMerge || isPush,
  };
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
