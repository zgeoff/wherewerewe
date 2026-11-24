export interface SourceToken {
  // a word is an identifier, keyword or number; a string holds its text without quotes; a template
  // or a regex literal is one `other` token; every other character is a punct
  readonly kind: 'word' | 'string' | 'punct' | 'other';
  readonly value: string;

  // the source line the token starts on, from 1
  readonly line: number;
}

interface Cursor {
  readonly source: string;
  readonly tokens: SourceToken[];
  at: number;
  line: number;

  // for each open parenthesis, whether an if, while, for or with keyword opens it
  readonly parens: boolean[];

  // the token of the last closing parenthesis that ended such a head, which a regex may follow
  headEnd: SourceToken | null;
}

// The tokens of TypeScript source with every comment left out. A string, a template literal and a
// regex literal each become one token, so a name inside one is no word; a template's substitution
// holds tokens of its own. It reads no types or scopes: it only splits the text.
export function parseSourceTokens(source: string): SourceToken[] {
  const cursor: Cursor = { source, tokens: [], at: 0, line: 1, parens: [], headEnd: null };

  scanCode(cursor, false);

  return cursor.tokens;
}

// Reads code until the end of the source, or in a template's substitution until its closing brace.
function scanCode(cursor: Cursor, isSubstitution: boolean): void {
  let depth = 0;

  while (cursor.at < cursor.source.length) {
    const char = cursor.source.charAt(cursor.at);
    const next = cursor.source.charAt(cursor.at + 1);

    if (char === '\n') {
      cursor.line += 1;
      cursor.at += 1;
    } else if (/\s/u.test(char)) {
      cursor.at += 1;
    } else if (char === '/' && next === '/') {
      skipLineComment(cursor);
    } else if (char === '/' && next === '*') {
      skipBlockComment(cursor);
    } else if (char === '"' || char === "'") {
      scanString(cursor, char);
    } else if (char === '`') {
      scanTemplate(cursor);
    } else if (char === '/' && isRegexStart(cursor)) {
      scanRegex(cursor);
    } else if (/[\w$]/u.test(char)) {
      scanWord(cursor);
    } else {
      if (isSubstitution && char === '}' && depth === 0) {
        cursor.at += 1;

        return;
      }

      depth += char === '{' ? 1 : 0;
      depth -= char === '}' ? 1 : 0;

      pushPunct(cursor, char);

      cursor.at += 1;
    }
  }
}

function skipLineComment(cursor: Cursor): void {
  const end = cursor.source.indexOf('\n', cursor.at);

  cursor.at = end === -1 ? cursor.source.length : end;
}

function skipBlockComment(cursor: Cursor): void {
  const end = cursor.source.indexOf('*/', cursor.at + 2);
  const stop = end === -1 ? cursor.source.length : end + 2;

  cursor.line += countLineBreaks(cursor.source.slice(cursor.at, stop));
  cursor.at = stop;
}

function countLineBreaks(text: string): number {
  return text.split('\n').length - 1;
}

function scanString(cursor: Cursor, quote: string): void {
  const startLine = cursor.line;
  let value = '';

  cursor.at += 1;

  while (cursor.at < cursor.source.length) {
    const char = cursor.source.charAt(cursor.at);

    if (char === quote || char === '\n') {
      break;
    }

    if (char === '\\') {
      value += cursor.source.charAt(cursor.at + 1);
      cursor.line += cursor.source.charAt(cursor.at + 1) === '\n' ? 1 : 0;
      cursor.at += 2;
    } else {
      value += char;
      cursor.at += 1;
    }
  }

  cursor.at += 1;

  cursor.tokens.push({ kind: 'string', value, line: startLine });
}

function scanTemplate(cursor: Cursor): void {
  const startLine = cursor.line;
  const parts: SourceToken[] = [];
  let text = '';

  cursor.at += 1;

  while (cursor.at < cursor.source.length) {
    const char = cursor.source.charAt(cursor.at);

    if (char === '`') {
      break;
    }

    if (char === '\\') {
      text += cursor.source.charAt(cursor.at + 1);
      cursor.line += cursor.source.charAt(cursor.at + 1) === '\n' ? 1 : 0;
      cursor.at += 2;
    } else if (char === '$' && cursor.source.charAt(cursor.at + 1) === '{') {
      cursor.at += 2;

      scanSubstitution(cursor, parts);
    } else {
      cursor.line += char === '\n' ? 1 : 0;
      text += char;
      cursor.at += 1;
    }
  }

  cursor.at += 1;

  // a template with no substitution is a string, so `process[`env`]` reads like `process['env']`
  if (parts.length === 0) {
    cursor.tokens.push({ kind: 'string', value: text, line: startLine });
  } else {
    cursor.tokens.push({ kind: 'other', value: '`', line: startLine }, ...parts);
  }
}

// The tokens of a substitution join the template's own list, which holds them in source order.
function scanSubstitution(cursor: Cursor, parts: SourceToken[]): void {
  const outer = cursor.tokens.splice(0);

  scanCode(cursor, true);

  parts.push(...cursor.tokens.splice(0));
  cursor.tokens.push(...outer);
}

// Words after which a slash starts a regex literal, not a division.
const regexPrecedingWords: ReadonlySet<string> = new Set([
  'return',
  'typeof',
  'case',
  'in',
  'of',
  'void',
  'delete',
  'throw',
  'new',
  'else',
  'do',
  'yield',
  'await',
]);

// A `)` that ends an if head starts a regex, and so does a `}`, because a block ends with one and
// no code divides an object literal. A `++` or `--` ends an operand, so a slash after it divides.
function isRegexStart(cursor: Cursor): boolean {
  const previous = cursor.tokens.at(-1);

  if (previous === undefined) {
    return true;
  }

  if (previous.kind === 'word') {
    return regexPrecedingWords.has(previous.value);
  }

  if (previous === cursor.headEnd) {
    return true;
  }

  const beforePrevious = cursor.tokens.at(-2);

  const isStep =
    (previous.value === '+' || previous.value === '-') &&
    beforePrevious?.kind === 'punct' &&
    beforePrevious.value === previous.value &&
    cursor.tokens.at(-3)?.value !== previous.value;

  return (
    previous.kind === 'punct' &&
    !isStep &&
    !isNonNullAssertion(cursor, previous, beforePrevious) &&
    !')]'.includes(previous.value)
  );
}

// A `!` straight after an operand, a name, a `)` or a `]`, ends that operand, so a slash after it
// divides. After a keyword or punctuation, a `!` is a not, and a slash after it starts a regex.
function isNonNullAssertion(
  cursor: Cursor,
  previous: SourceToken,
  beforePrevious: SourceToken | undefined,
): boolean {
  if (previous.value !== '!' || beforePrevious === undefined) {
    return false;
  }

  if (beforePrevious.kind === 'word') {
    return !regexPrecedingWords.has(beforePrevious.value);
  }

  return beforePrevious !== cursor.headEnd && ')]'.includes(beforePrevious.value);
}

function scanRegex(cursor: Cursor): void {
  const startLine = cursor.line;
  const start = cursor.at;
  let isClass = false;

  cursor.at += 1;

  while (cursor.at < cursor.source.length) {
    const char = cursor.source.charAt(cursor.at);

    if (char === '\n') {
      break;
    }

    if (char === '\\') {
      cursor.at += 2;
    } else if (char === '/' && !isClass) {
      cursor.at += 1;
      break;
    } else {
      isClass = char === '[' || (isClass && char !== ']');
      cursor.at += 1;
    }
  }

  while (/[a-z]/u.test(cursor.source.charAt(cursor.at))) {
    cursor.at += 1;
  }

  cursor.tokens.push({
    kind: 'other',
    value: cursor.source.slice(start, cursor.at),
    line: startLine,
  });
}

function scanWord(cursor: Cursor): void {
  const start = cursor.at;

  while (/[\w$]/u.test(cursor.source.charAt(cursor.at))) {
    cursor.at += 1;
  }

  cursor.tokens.push({
    kind: 'word',
    value: cursor.source.slice(start, cursor.at),
    line: cursor.line,
  });
}

const headWords: ReadonlySet<string> = new Set(['if', 'while', 'for', 'with']);

// Pushes one punctuation token, and follows the parentheses so a regex after the head of an if,
// while, for or with is told from a division after a grouped value.
function pushPunct(cursor: Cursor, char: string): void {
  const token: SourceToken = { kind: 'punct', value: char, line: cursor.line };
  const [before, beforeThat] = [cursor.tokens.at(-1), cursor.tokens.at(-2)];

  if (char === '(') {
    const isAwaitHead = before?.value === 'await' && beforeThat?.value === 'for';

    cursor.parens.push(before?.kind === 'word' && (headWords.has(before.value) || isAwaitHead));
  }

  if (char === ')' && cursor.parens.pop() === true) {
    cursor.headEnd = token;
  }

  cursor.tokens.push(token);
}
