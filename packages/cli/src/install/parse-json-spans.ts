export type JSONNode =
  | {
      readonly kind: 'object';
      readonly start: number;
      readonly end: number;
      readonly members: readonly JSONMember[];
    }
  | {
      readonly kind: 'array';
      readonly start: number;
      readonly end: number;
      readonly elements: readonly JSONNode[];
    }
  | { readonly kind: 'scalar'; readonly start: number; readonly end: number };

// The tree of a JSON text with the character span of every value, for a text that `JSON.parse`
// already accepted: `end` is one past the value's last character.
export function parseJSONSpans(text: string): JSONNode {
  return scanValue(text, skipSpace(text, 0)).node;
}

interface Scan {
  readonly node: JSONNode;
  readonly next: number;
}

function scanValue(text: string, start: number): Scan {
  const first = text[start];

  if (first === '{') {
    return scanObject(text, start);
  }

  if (first === '[') {
    return scanArray(text, start);
  }

  const end = first === '"' ? skipString(text, start) : skipBare(text, start);

  return { node: { kind: 'scalar', start, end }, next: end };
}

export interface JSONMember {
  readonly key: string;
  readonly keyStart: number;
  readonly value: JSONNode;
}

function scanObject(text: string, start: number): Scan {
  const members: JSONMember[] = [];
  let at = skipSpace(text, start + 1);

  while (text[at] !== '}') {
    const keyEnd = skipString(text, at);
    const key: unknown = JSON.parse(text.slice(at, keyEnd));
    const valueRead = scanValue(text, skipSpace(text, skipSpace(text, keyEnd) + 1));

    members.push({ key: String(key), keyStart: at, value: valueRead.node });

    at = skipSpace(text, valueRead.next);
    at = text[at] === ',' ? skipSpace(text, at + 1) : at;
  }

  return { node: { kind: 'object', start, end: at + 1, members }, next: at + 1 };
}

const whitespace: ReadonlySet<string> = new Set([' ', '\t', '\n', '\r']);

function skipSpace(text: string, from: number): number {
  let at = from;

  while (whitespace.has(text[at] ?? '')) {
    at += 1;
  }

  return at;
}

function skipString(text: string, start: number): number {
  let at = start + 1;

  while (text[at] !== '"') {
    at += text[at] === '\\' ? 2 : 1;
  }

  return at + 1;
}

function scanArray(text: string, start: number): Scan {
  const elements: JSONNode[] = [];
  let at = skipSpace(text, start + 1);

  while (text[at] !== ']') {
    const elementRead = scanValue(text, at);

    elements.push(elementRead.node);

    at = skipSpace(text, elementRead.next);
    at = text[at] === ',' ? skipSpace(text, at + 1) : at;
  }

  return { node: { kind: 'array', start, end: at + 1, elements }, next: at + 1 };
}

function skipBare(text: string, start: number): number {
  let at = start;

  while (at < text.length && !whitespace.has(text[at] ?? '') && !',]}'.includes(text[at] ?? '')) {
    at += 1;
  }

  return at;
}
