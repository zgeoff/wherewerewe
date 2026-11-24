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

  for (const [at, token] of tokens.entries()) {
    const key =
      stack.at(-1) === 'object' && isPropertyStart(tokens, at) ? findKey(tokens, at) : null;

    if (key !== null) {
      keys.add(key);
    }

    if (token.kind === 'punct' && token.value === '{') {
      const isPattern =
        assignedOpens.has(at) ||
        isDeclaration(tokens.at(at - 1)) ||
        ((stack.at(-1) === 'params' || stack.at(-1) === 'pattern') &&
          tokens.at(at - 1)?.value !== '=');

      const frame: Frame = isPattern ? 'pattern' : 'object';

      stack.push(frame);
    } else if (token.kind === 'punct' && '(['.includes(token.value)) {
      const frame: Frame = paramOpens.has(at) ? 'params' : 'other';

      stack.push(frame);
    } else if (token.kind === 'punct' && '})]'.includes(token.value)) {
      stack.pop();
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

      if (open !== undefined && !isHead && (isArrow || after?.value === '{')) {
        params.add(open);
      }
    }
  }

  return params;
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
