const maxCharacters = 100;

// A line of more than 100 code points becomes its first 99 and `…`; a shorter one is unchanged.
export function cutLine(line: string): string {
  const characters = Array.from(line, (character) => character);

  return characters.length > maxCharacters
    ? `${characters.slice(0, maxCharacters - 1).join('')}…`
    : line;
}
