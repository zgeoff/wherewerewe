// A Run line with each unquoted `<placeholder>` filled, a choice as its first choice and any other
// as `zz-a`, and each unquoted `[optional group]` left out, as a test fills a usage line. Quoted
// and backslash-escaped text stays as printed.
export function buildShellReplayLine(text: string): string {
  let printed = '';
  let depth = 0;
  let index = 0;

  while (index < text.length) {
    const span = parseSpan(text, index);

    if (span.kind === 'open') {
      depth += 1;
    } else if (span.kind === 'close') {
      depth -= 1;
    } else if (depth === 0) {
      printed += span.kind === 'placeholder' ? fillPlaceholder(span.text) : span.text;
    }

    index += span.text.length;
  }

  return printed;
}

interface Span {
  readonly kind: 'text' | 'placeholder' | 'open' | 'close';
  readonly text: string;
}

function parseSpan(text: string, index: number): Span {
  const char = text.charAt(index);

  if (char === '[' || char === ']') {
    return { kind: char === '[' ? 'open' : 'close', text: char };
  }

  if (char === '<') {
    return {
      kind: 'placeholder',
      text: text.slice(index, getEnd(text, text.indexOf('>', index))),
    };
  }

  if (char === '\\') {
    return { kind: 'text', text: text.slice(index, index + 2) };
  }

  if (char === "'") {
    return { kind: 'text', text: text.slice(index, getEnd(text, text.indexOf("'", index + 1))) };
  }

  if (char === '$' && text.charAt(index + 1) === "'") {
    return { kind: 'text', text: text.slice(index, getQuoteEnd(text, index + 2, "'") + 1) };
  }

  if (char === '"') {
    return { kind: 'text', text: text.slice(index, getQuoteEnd(text, index + 1, '"') + 1) };
  }

  return { kind: 'text', text: char };
}

// The index after a closing character, or the end of the text when none closes it, so a line whose
// quote a bug left open still ends.
function getEnd(text: string, closeAt: number): number {
  return closeAt === -1 ? text.length : closeAt + 1;
}

function getQuoteEnd(text: string, start: number, quote: string): number {
  let index = start;

  while (index < text.length && text.charAt(index) !== quote) {
    index += text.charAt(index) === '\\' ? 2 : 1;
  }

  return index;
}

function fillPlaceholder(placeholder: string): string {
  const inner = placeholder.slice(1, -1);

  return inner.includes('|') ? (inner.split('|')[0] ?? '') : 'zz-a';
}
