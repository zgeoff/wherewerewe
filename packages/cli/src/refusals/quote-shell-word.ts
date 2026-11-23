// Writes one word so a POSIX shell reads it back as that word. A word of safe characters stays
// bare. Any other word goes in double quotes, with `"`, `$`, a backtick and `\` escaped, or, when
// it holds `!`, in single quotes, because an interactive shell expands `!` inside double quotes.
export function quoteShellWord(word: string): string {
  if (word !== '' && !/[\s"'$`\\;&|()*?!{}[\]~<>]|^#/u.test(word)) {
    return word;
  }

  if (word.includes('!')) {
    return `'${word.replaceAll("'", String.raw`'\''`)}'`;
  }

  return `"${word.replaceAll(/(?<special>["$`\\])/gu, String.raw`\$<special>`)}"`;
}
