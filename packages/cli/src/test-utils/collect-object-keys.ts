import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

type Frame = 'object' | 'pattern' | 'params' | 'other';

// The keys that an object literal of the source sets: `{ NAME: v }`, a quoted `{ "NAME": v }`, a
// computed `{ ["NAME"]: v }` and a shorthand `{ NAME }`. A name that only a string, a comment or a
// destructuring pattern holds is no key, a pattern in a function's parameters included.
export function collectObjectKeys(source: string): Set<string> {
  const tokens = parseSourceTokens(source);
  const assignedOpens = findAssignedOpens(tokens);
  const paramOpens = findParameterOpens(tokens);

  const keys = new Set<string>();

  const stack: Frame[] = [];

  // for each frame, whether its position is inside a default value, which holds no pattern
  const defaults: boolean[] = [];

  for (const [at, token] of tokens.entries()) {
    const key =
      stack.at(-1) === 'object' && isPropertyStart(tokens, at) ? findKey(tokens, at) : null;

    if (key !== null) {
      keys.add(key);
    }

    const isPatternSite =
      (stack.at(-1) === 'params' || stack.at(-1) === 'pattern') && defaults.at(-1) !== true;

    if (token.kind === 'punct' && token.value === '{') {
      const isPattern = assignedOpens.has(at) || isDeclaration(tokens.at(at - 1)) || isPatternSite;
      const frame: Frame = isPattern ? 'pattern' : 'object';

      stack.push(frame);
      defaults.push(false);
    } else if (token.kind === 'punct' && token.value === '[') {
      // an array pattern inside a parameter or a pattern is a pattern, and so is each { in it
      const frame: Frame = isPatternSite ? 'pattern' : 'other';

      stack.push(frame);
      defaults.push(false);
    } else if (token.kind === 'punct' && token.value === '(') {
      const frame: Frame = paramOpens.has(at) ? 'params' : 'other';

      stack.push(frame);
      defaults.push(false);
    } else if (token.kind === 'punct' && '})]'.includes(token.value)) {
      stack.pop();
      defaults.pop();
    } else if (token.kind === 'punct' && token.value === '=' && isAssignment(tokens, at)) {
      defaults[defaults.length - 1] = true;
    } else if (token.kind === 'punct' && token.value === ',') {
      defaults[defaults.length - 1] = false;
    }
  }

  return keys;
}

// The index of each `{` whose block ends before an `=`, a destructuring pattern, and not before `==`
// or `=>`.
function findAssignedOpens(tokens: readonly SourceToken[]): Set<number> {
  const opens: number[] = [];

  const patterns = new Set<number>();

  for (const [at, token] of tokens.entries()) {
    if (token.kind === 'punct' && token.value === '{') {
      opens.push(at);
    } else if (token.kind === 'punct' && token.value === '}') {
      const open = opens.pop();
      const after = tokens.at(at + 1);
      const afterThat = tokens.at(at + 2);

      const isAssigned =
        after?.value === '=' && afterThat?.value !== '=' && afterThat?.value !== '>';

      if (open !== undefined && isAssigned) {
        patterns.add(open);
      }
    }
  }

  return patterns;
}

const headWords: ReadonlySet<string> = new Set(['if', 'while', 'for', 'switch', 'with']);

// The index of each `(` that opens the parameters of a function: its `)` is followed by `=>` or by
// a body, and no if, while, for, switch or with keyword comes before it. A `catch` clause counts.
function findParameterOpens(tokens: readonly SourceToken[]): Set<number> {
  const opens: number[] = [];

  const params = new Set<number>();

  for (const [at, token] of tokens.entries()) {
    if (token.kind === 'punct' && token.value === '(') {
      opens.push(at);
    } else if (token.kind === 'punct' && token.value === ')') {
      const open = opens.pop();
      const before = open === undefined ? undefined : tokens.at(open - 1);
      const after = tokens.at(at + 1);
      const isArrow = after?.value === '=' && tokens.at(at + 2)?.value === '>';
      const isHead = before?.kind === 'word' && headWords.has(before.value);

      const hasBody =
        after?.value === '{' ||
        (after?.value === ':' &&
          open !== undefined &&
          !isTernaryBranch(tokens, open) &&
          isBodyAfterType(tokens, at + 2));

      if (open !== undefined && !isHead && (isArrow || hasBody)) {
        params.add(open);
      }
    }
  }

  return params;
}

// Whether the `(` at the index sits in the middle branch of a ternary that is still open at its own
// depth, so the `:` after its `)` starts the other branch and no return type. An optional `?.`, a
// `??` and the `?` of an optional parameter are no ternary.
function isTernaryBranch(tokens: readonly SourceToken[], open: number): boolean {
  let depth = 0;
  let colons = 0;

  for (let at = open - 1; at >= 0; at -= 1) {
    const token = tokens.at(at);
    const value = token?.kind === 'punct' ? token.value : '';

    if (')]}'.includes(value || ' ')) {
      depth += 1;
    } else if ('([{'.includes(value || ' ')) {
      depth -= 1;
    } else if (depth === 0 && (value === ';' || value === '=')) {
      return false;
    } else if (depth === 0 && value === ':') {
      colons += 1;
    } else if (depth === 0 && value === '?' && isTernaryMark(tokens, at)) {
      if (colons === 0) {
        return true;
      }

      colons -= 1;
    }

    if (depth < 0) {
      return false;
    }
  }

  return false;
}

function isTernaryMark(tokens: readonly SourceToken[], at: number): boolean {
  const after = tokens.at(at + 1)?.value;

  return after !== '.' && after !== '?' && after !== ':' && tokens.at(at - 1)?.value !== '?';
}

// Whether the type that starts at the index is followed by a function body or an arrow: a `{` or an
// `=>` at the type's own depth, after a name or a closing bracket. A `{` that starts the type, or
// follows `|`, `&`, `<` or `,`, is an object type, which the walk skips.
function isBodyAfterType(tokens: readonly SourceToken[], start: number): boolean {
  const closers: Readonly<Record<string, string>> = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const stack: string[] = [];

  for (let at = start; at < tokens.length; at += 1) {
    const token = tokens.at(at);
    const value = token?.kind === 'punct' ? token.value : '';
    const previous = tokens.at(at - 1);

    if (
      stack.length === 0 &&
      value === '{' &&
      previous?.value !== ':' &&
      !'|&<,('.includes(previous?.value ?? ' ')
    ) {
      return true;
    }

    if (stack.length === 0 && value === '=' && tokens.at(at + 1)?.value === '>') {
      return true;
    }

    if (
      stack.length === 0 &&
      (value === ';' || value === '=' || value === ',' || '})]'.includes(value || ' '))
    ) {
      return false;
    }

    if (value in closers) {
      stack.push(closers[value] ?? '');
    } else if (stack.at(-1) === value && value !== '') {
      stack.pop();
    }
  }

  return false;
}

function isPropertyStart(tokens: readonly SourceToken[], at: number): boolean {
  const previous = tokens.at(at - 1);

  return previous?.kind === 'punct' && (previous.value === '{' || previous.value === ',');
}

function findKey(tokens: readonly SourceToken[], at: number): string | null {
  const token = tokens.at(at);
  const next = tokens.at(at + 1);

  if (
    token?.kind === 'word' &&
    (next?.value === ':' || next?.value === ',' || next?.value === '}')
  ) {
    return token.value;
  }

  if (token?.kind === 'string' && next?.value === ':') {
    return token.value;
  }

  const name = tokens.at(at + 1);
  const close = tokens.at(at + 2);
  const colon = tokens.at(at + 3);

  const isComputed =
    token?.value === '[' && name?.kind === 'string' && close?.value === ']' && colon?.value === ':';

  return isComputed ? (name?.value ?? null) : null;
}

function isDeclaration(token: SourceToken | undefined): boolean {
  return (
    token?.kind === 'word' &&
    (token.value === 'const' || token.value === 'let' || token.value === 'var')
  );
}

// Whether the `=` at the index is an assignment or a default, and no part of `==`, `=>`, `<=`, `>=`
// or `!=`.
function isAssignment(tokens: readonly SourceToken[], at: number): boolean {
  const before = tokens.at(at - 1)?.value;
  const after = tokens.at(at + 1)?.value;

  return !'=!<>'.includes(before ?? ' ') && after !== '=' && after !== '>';
}
