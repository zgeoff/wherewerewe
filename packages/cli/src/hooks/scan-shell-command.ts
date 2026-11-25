// What the gate reads of a shell command: its pipeline's segments, each a list of words and
// redirects. A command that holds anything the gate does not read is not a scan.
export interface ShellSegment {
  // the words after quote removal, redirects and their targets left out
  readonly words: readonly string[];
  readonly hasRedirect: boolean;
}

interface ScanState {
  readonly segments: ShellSegment[];
  words: string[];
  hasRedirect: boolean;
  word: string | null;
  isTargetNext: boolean;
}

// Reads the command as the shell does, for the rules of sessions-and-hooks.md: separators and
// substitutions outside single quotes end the read, a pipe starts a segment, and a quote, a
// backslash or a redirect belongs to its word. Returns null for a command the gate gates.
export function scanShellCommand(command: string): readonly ShellSegment[] | null {
  const state: ScanState = {
    segments: [],
    words: [],
    hasRedirect: false,
    word: null,
    isTargetNext: false,
  };

  let index = 0;

  while (index < command.length) {
    const step = scanChar(command, index, state);

    if (step === null) {
      return null;
    }

    index = step;
  }

  endWord(state);

  if (state.isTargetNext) {
    return null;
  }

  endSegment(state);

  return state.segments;
}

// The index after what it read, or null when the character makes the command gated.
function scanChar(command: string, index: number, state: ScanState): number | null {
  const char = command.charAt(index);
  const next = command.charAt(index + 1);

  if (char === ' ' || char === '\t') {
    endWord(state);

    return index + 1;
  }

  if (char === "'" || char === '"') {
    return scanQuoted(command, index, state);
  }

  if (char === '\\') {
    const escaped = next === '' ? '\\' : next;

    addToWord(state, escaped);

    return index + 2;
  }

  if (char === '$') {
    const isGated = next === '(' || next === "'";

    return isGated ? null : addChar(state, char, index);
  }

  if (char === '|') {
    return scanPipe(next, index, state);
  }

  if (char === '<' || char === '>' || char === '&') {
    return scanRedirect(command, index, state);
  }

  const isGated =
    char === ';' ||
    char === '`' ||
    char === '\n' ||
    char === '(' ||
    char === ')' ||
    (char === '#' && state.word === null);

  return isGated ? null : addChar(state, char, index);
}

function endWord(state: ScanState): void {
  if (state.word === null) {
    return;
  }

  if (state.isTargetNext) {
    state.isTargetNext = false;
  } else {
    state.words.push(state.word);
  }

  state.word = null;
}

const specials: ReadonlySet<string> = new Set(['"', '\\', '$', '`']);

function scanQuoted(command: string, start: number, state: ScanState): number | null {
  const quote = command.charAt(start);

  addToWord(state, '');

  let index = start + 1;

  while (index < command.length) {
    const char = command.charAt(index);
    const next = command.charAt(index + 1);

    if (char === quote) {
      return index + 1;
    }

    if (quote === '"' && (char === '`' || (char === '$' && next === '('))) {
      return null;
    }

    if (quote === '"' && char === '\\' && specials.has(next)) {
      addToWord(state, next);

      index += 2;
    } else {
      addToWord(state, char);

      index += 1;
    }
  }

  return null;
}

function addToWord(state: ScanState, text: string): void {
  state.word = `${state.word ?? ''}${text}`;
}

function addChar(state: ScanState, char: string, index: number): number {
  addToWord(state, char);

  return index + 1;
}

function scanPipe(next: string, index: number, state: ScanState): number | null {
  if (next === '|' || next === '&' || state.isTargetNext) {
    return null;
  }

  endWord(state);
  endSegment(state);

  return index + 1;
}

function endSegment(state: ScanState): void {
  state.segments.push({ words: state.words, hasRedirect: state.hasRedirect });

  state.words = [];
  state.hasRedirect = false;
}

// A redirect's `&` belongs to it, as in `2>&1` and `&>`; any other `&`, and a heredoc or a
// process substitution, is gated.
function scanRedirect(command: string, index: number, state: ScanState): number | null {
  const char = command.charAt(index);
  const next = command.charAt(index + 1);
  const isFd = state.word !== null && /^\d+$/u.test(state.word);

  if (char === '&' && next !== '>') {
    return null;
  }

  if ((char === '<' && next === '<') || next === '(' || state.isTargetNext) {
    return null;
  }

  if (isFd) {
    state.word = null;
  } else {
    endWord(state);
  }

  state.hasRedirect = true;
  state.isTargetNext = true;

  const operator = /^(?:&>>?|>>|>&|>\||>|<&|<)/u.exec(command.slice(index))?.[0] ?? char;

  return index + operator.length;
}
