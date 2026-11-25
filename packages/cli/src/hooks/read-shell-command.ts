import { scanShellCommand } from './scan-shell-command.ts';
import type { ShellSegment } from './scan-shell-command.ts';
import { stripLineContinuations } from './strip-line-continuations.ts';
import type { Harness } from './types.ts';
import { unwrapShell } from './unwrap-shell.ts';

export type ShellCommandKind = 'brief-command' | 'www-command' | 'other';

// Sorts a command by the grammar of sessions-and-hooks.md: the brief command, any other `www`
// command, or any other call. The brief command is one bare `www`, alone or with `--session` and
// the bound name, with no redirect or pipe; a `www` command may redirect, and pipe to a filter.
export function readShellCommand(
  command: string,
  bound: string,
  harness: Harness,
): ShellCommandKind {
  const inner = harness === 'codex' ? unwrapShell(command.trim()) : command;
  const segments = scanShellCommand(stripLineContinuations(inner));
  const [first] = segments ?? [];

  if (segments === null || first === undefined || !isWwwWords(first.words)) {
    return 'other';
  }

  if (!segments.slice(1).every((segment) => isFilterSegment(segment))) {
    return 'other';
  }

  const args = first.words.slice(1);

  const isBrief =
    segments.length === 1 &&
    !first.hasRedirect &&
    (args.length === 0 ||
      (args.length === 2 && args[0] === '--session' && args[1] === bound) ||
      (args.length === 1 && args[0] === `--session=${bound}`));

  return isBrief ? 'brief-command' : 'www-command';
}

function isWwwWords(words: readonly string[]): boolean {
  const [program] = words;
  const name = program?.split('/').at(-1);
  const isPlain = program?.includes('/') !== true;
  const isAbsolute = program?.startsWith('/') === true;

  return (name === 'www' || name === 'wherewerewe') && (isPlain || isAbsolute);
}

const filters: ReadonlySet<string> = new Set(['head', 'tail', 'grep', 'wc', 'sort']);

function isFilterSegment(segment: ShellSegment): boolean {
  const [name] = segment.words;

  return name !== undefined && filters.has(name);
}
