const splitLines = /[ \t]*(?:\r\n|[\n\v\f\r\u0085\u2028\u2029])[ \t]*/gu;

// The text with each line break, and the spaces and tabs around it, taken out. A credential that a
// line break splits matches the credential test again in the joined text.
export function joinSplitLines(text: string): string {
  return text.replaceAll(splitLines, '');
}
