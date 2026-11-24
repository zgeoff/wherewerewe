// The source text with each block comment and each line comment cut out, so a name in a comment
// counts as no use. A `//` counts as a comment only at the start of a line or after a space, so a
// URL in a string stays.
export function stripComments(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//gu, '')
    .replaceAll(/(?<start>^|\s)\/\/.*$/gmu, '$<start>');
}
