// The simple commands a shell would run for `text`, each as its words after quote removal. One ends
// at an unquoted `;`, `&`, `|`, line break, backtick or bracket, and loses a leading `NAME=value`.
// The text after an unquoted `<<` is a heredoc body, not commands.
export function collectSimpleCommands(text: string): readonly (readonly string[])[] {
  const commands: string[][] = [];
  let words: string[] = [];
  let word: string | null = null;
  let quote: string | null = null;

  const endWord = (): void => {
    if (word !== null) {
      words.push(word);
    }

    word = null;
  };

  const endCommand = (): void => {
    endWord();

    const first = words.findIndex((entry) => !/^[A-Za-z_][A-Za-z0-9_]*=/u.test(entry));

    if (first !== -1) {
      commands.push(words.slice(first));
    }

    words = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);

    if (quote !== null) {
      if (char === quote) {
        quote = null;
      } else if (quote === '"' && char === '\\') {
        word = `${word ?? ''}${text.charAt(index + 1)}`;
        index += 1;
      } else {
        word = `${word ?? ''}${char}`;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      word ??= '';
    } else if (char === '\\') {
      word = `${word ?? ''}${text.charAt(index + 1)}`;
      index += 1;
    } else if (char === '<' && text.charAt(index + 1) === '<') {
      endCommand();

      return commands;
    } else if (/[;&|\n`(){}]/u.test(char)) {
      endCommand();
    } else if (char === ' ' || char === '\t') {
      endWord();
    } else {
      word = `${word ?? ''}${char}`;
    }
  }

  endCommand();

  return commands;
}
