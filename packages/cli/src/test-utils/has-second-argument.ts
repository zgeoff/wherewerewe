// True when a call of the named function has a second argument: a comma that no `)` follows sits at
// the depth of its own parentheses. The declaration is not a call.
export function hasSecondArgument(text: string, name: string): boolean {
  return text
    .replaceAll(`function ${name}(`, '')
    .split(`${name}(`)
    .slice(1)
    .some((rest) => {
      let depth = 1;

      for (let index = 0; index < rest.length; index += 1) {
        const character = rest.charAt(index);

        depth += '([{'.includes(character) ? 1 : 0;
        depth -= ')]}'.includes(character) ? 1 : 0;

        if (depth === 0) {
          return false;
        }

        if (depth === 1 && character === ',' && !/^\s*\)/u.test(rest.slice(index + 1))) {
          return true;
        }
      }

      return false;
    });
}
