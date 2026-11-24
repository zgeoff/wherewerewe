// Words of 20 characters and one shorter, joined by single spaces, to the length asked for: a
// wrap of it carries the fewest characters on each line.
export function buildSpacedText(length: number): string {
  const words: string[] = [];
  let used = 0;

  while (used < length) {
    const gap = words.length > 0 ? 1 : 0;
    const room = length - used - gap;
    const word = 'g'.repeat(Math.min(20, room));

    words.push(word);

    used += word.length + gap;
  }

  return words.join(' ');
}
