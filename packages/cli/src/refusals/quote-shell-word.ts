import { lineBreakPattern } from '../rules/line-break-pattern.ts';

// Writes one word, on one line, so a POSIX shell reads it back. A tab or line break goes in $'…' as
// octal UTF-8 escapes. An interactive shell expands `!` inside double quotes, so a word with `!`
// goes in single quotes, and any other word that is not safe characters goes in double quotes.
export function quoteShellWord(word: string): string {
  if (lineBreakPattern.test(word)) {
    return `$'${Array.from(word, (character) => escapeCharacter(character)).join('')}'`;
  }

  if (word !== '' && !/[\s"'$`\\;&|()*?!{}[\]~<>]|^#/u.test(word)) {
    return word;
  }

  if (word.includes('!')) {
    return `'${word.replaceAll("'", String.raw`'\''`)}'`;
  }

  return `"${word.replaceAll(/(?<special>["$`\\])/gu, String.raw`\$<special>`)}"`;
}

function escapeCharacter(character: string): string {
  if (character === '\\' || character === "'") {
    return `\\${character}`;
  }

  if (!lineBreakPattern.test(character)) {
    return character;
  }

  return Array.from(
    new TextEncoder().encode(character),
    (byte) => `\\${byte.toString(8).padStart(3, '0')}`,
  ).join('');
}
