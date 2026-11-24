const maxWidth = 100;
const minWidth = 85;

// Breaks text into lines of at most 100 characters. A line ends at the last space that leaves it 85
// to 100 characters long, and drops that space; with no such space, it ends at 100. `first` starts
// the first line and `rest` each further line. Counts code points.
export function wrapBlock(text: string, first: string, rest: string): string[] {
  const lines: string[] = [];
  let remaining = Array.from(text, (character) => character);
  let prefix = first;

  while (prefix.length + remaining.length > maxWidth) {
    const room = maxWidth - prefix.length;
    const lowest = minWidth - prefix.length;
    let end = room;
    let isSpace = false;

    for (let at = room; at >= lowest && at > 0; at -= 1) {
      if (remaining[at] === ' ') {
        end = at;
        isSpace = true;
        break;
      }
    }

    lines.push(prefix + remaining.slice(0, end).join(''));

    const skip = isSpace ? end + 1 : end;

    remaining = remaining.slice(skip);
    prefix = rest;
  }

  // a space that ends the text at a break leaves nothing to carry, so no line of prefix alone
  return remaining.length === 0 && lines.length > 0
    ? lines
    : [...lines, prefix + remaining.join('')];
}
