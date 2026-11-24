import { parseSourceTokens } from './parse-source-tokens.ts';
import type { SourceToken } from './parse-source-tokens.ts';

// The keys that an object literal of the source sets: `{ NAME: v }`, a quoted `{ "NAME": v }`, a
// computed `{ ["NAME"]: v }` and a shorthand `{ NAME }`. A name that only a string, a comment or a
// destructuring pattern holds is no key.
export function collectObjectKeys(source: string): Set<string> {
  const tokens = parseSourceTokens(source);
  const patternOpens = findPatternOpens(tokens);

  const keys = new Set<string>();

  const stack: { readonly isObject: boolean }[] = [];

  for (const [at, token] of tokens.entries()) {
    const key =
      stack.at(-1)?.isObject === true && isPropertyStart(tokens, at) ? findKey(tokens, at) : null;

    if (key !== null) {
      keys.add(key);
    }

    if (token.kind === 'punct' && '{(['.includes(token.value)) {
      stack.push({ isObject: token.value === '{' && !patternOpens.has(at) });
    } else if (token.kind === 'punct' && '})]'.includes(token.value)) {
      stack.pop();
    }
  }

  return keys;
}

// The index of each `{` whose block ends before an `=`, a destructuring pattern, and not before `==`
// or `=>`.
function findPatternOpens(tokens: readonly SourceToken[]): Set<number> {
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
