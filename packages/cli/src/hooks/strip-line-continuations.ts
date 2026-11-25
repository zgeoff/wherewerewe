// Removes each backslash that ends a line, with its line break, outside single quotes, as the
// shell does. A backslash that another backslash escapes ends no line.
export function stripLineContinuations(command: string): string {
  let result = '';
  let quote: 'none' | 'single' | 'double' = 'none';
  let index = 0;

  while (index < command.length) {
    const char = command.charAt(index);
    const next = command.charAt(index + 1);

    if (quote === 'single') {
      quote = char === "'" ? 'none' : 'single';
      result += char;
      index += 1;
    } else if (char === '\\' && next === '\n') {
      index += 2;
    } else if (char === '\\') {
      result += `${char}${next}`;
      index += 2;
    } else {
      quote = pickQuote(quote, char);
      result += char;
      index += 1;
    }
  }

  return result;
}

function pickQuote(
  quote: 'none' | 'single' | 'double',
  char: string,
): 'none' | 'single' | 'double' {
  if (quote === 'double') {
    return char === '"' ? 'none' : 'double';
  }

  if (char === "'") {
    return 'single';
  }

  return char === '"' ? 'double' : 'none';
}
